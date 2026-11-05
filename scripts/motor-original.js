// Motor de previsión del HTML original (sin los datos), para comprobar que la app da lo mismo.
// Variables que se inyectan al ejecutarlo: __DATOS__ (texto JSON del modelo) y __HOY__ ('AAAA-MM-DD').
// Motor de prediccion: arboles de LightGBM exportados + calendario precalculado
function arbol(n, x) {
  while (Array.isArray(n)) {
    let v = x[n[0]];
    const mt = n[3];
    let izq;
    if (mt === 'NaN' && Number.isNaN(v)) izq = n[2] === 1;
    else if (mt === 'Zero' && (v === 0 || Number.isNaN(v))) izq = n[2] === 1;
    else { if (Number.isNaN(v)) v = 0; izq = v <= n[1]; }
    n = izq ? n[4] : n[5];
  }
  return n;
}
function predecirModelo(m, x) {
  let s = 0;
  for (const t of m.trees) s += arbol(t, x);
  return m.obj === 'poisson' ? Math.exp(s) : s;
}
function filaCalendario(datos, iso) {
  const ini = Date.UTC(...datos.calendario.inicio.split('-').map((v, i) => i === 1 ? v - 1 : +v));
  const [a, m, d] = iso.split('-').map(Number);
  const i = Math.round((Date.UTC(a, m - 1, d) - ini) / 86400000);
  return datos.calendario.filas[i];
}



const D = JSON.parse(__DATOS__);
const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const DIAS_C = ['dom','lun','mar','mié','jue','vie','sáb'];
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const $ = id => document.getElementById(id);

// ---- fechas (siempre como 'AAAA-MM-DD', calculadas en UTC para evitar líos de horario)
const isoHoy = () => __HOY__;
const iso = ms => new Date(ms).toISOString().slice(0, 10);
const ms = s => { const [a, m, d] = s.split('-').map(Number); return Date.UTC(a, m - 1, d); };
const sumar = (s, n) => iso(ms(s) + n * 86400000);
const dif = (a, b) => Math.round((ms(a) - ms(b)) / 86400000);
const dsem = s => new Date(ms(s)).getUTCDay();
const larga = s => { const [a, m, d] = s.split('-').map(Number); return `${DIAS[dsem(s)]} ${d} de ${MESES[m - 1]} de ${a}`; };
const fmt = n => Math.round(n).toLocaleString('es-ES');

// ---- tiempo (Open-Meteo, solo si hay internet)
const TIEMPO = {};

// ---- prevision
function errorPara(h) {
  const hs = Object.keys(D.error_res).map(Number).sort((a, b) => a - b);
  let e = D.error_res[hs[0]];
  for (const k of hs) if (k <= h) e = D.error_res[k];
  return e;
}
function prever(f, rc, rn) {
  const out = { fecha: f };
  if (f < D.datos_hasta && D.historico[f]) {
    const [c, n, reservadas, cerr] = D.historico[f];
    return Object.assign(out, { tipo: 'pasado', comida: c, cena: n, reservadas, cerrado: !!cerr });
  }
  const cal = filaCalendario(D, f);
  if (!cal) return Object.assign(out, { tipo: 'fuera' });
  const conRes = rc !== null || rn !== null;
  rc = rc || 0; rn = rn || 0;
  let comida, cena, nc = 0, nn = 0, margen;
  if (conRes) {
    const h = Math.min(Math.max(dif(f, isoHoy()), 0), 60);
    const x = cal.concat([rc, rn, rc + rn, h]);
    nc = Math.max(0, Math.round(predecirModelo(D.modelos.res_comida, x)));
    nn = Math.max(0, Math.round(predecirModelo(D.modelos.res_cena, x)));
    comida = rc + nc; cena = rn + nn; margen = errorPara(h);
  } else {
    comida = Math.round(predecirModelo(D.modelos.sin_comida, cal));
    cena = Math.round(predecirModelo(D.modelos.sin_cena, cal));
    margen = D.error_sin;
  }
  const esp = D.especiales[f.slice(5)];
  let especial = null;
  if (esp && esp.anios.length) {
    const mc = esp.anios.reduce((s, a) => s + a[1], 0) / esp.anios.length;
    const mn = esp.anios.reduce((s, a) => s + a[2], 0) / esp.anios.length;
    comida = Math.max(comida, Math.round(mc)); cena = Math.max(cena, Math.round(mn));
    especial = esp;
  }
  const festivo = D.festivos[f] || null;
  return Object.assign(out, { tipo: 'prevision', conRes, rc, rn, comida, cena, nc: comida - rc, nn: cena - rn,
    margen, especial, festivo, lunes: dsem(f) === 1 && !festivo, tiempo: TIEMPO[f] || null });
}

// ---- lo que vino otros anios (solo dias con asistencia real, desde oct-2024)
function referencia(f) {
  const ds = dsem(f), mes = f.slice(5, 7), out = [];
  const vals = Object.entries(D.historico).filter(([k, v]) => v[0] !== null && !v[3] && k.slice(5, 7) === mes && dsem(k) === ds && k < f.slice(0, 4) + '-' + mes);
  const prevAnios = vals.filter(([k]) => k.slice(0, 4) < f.slice(0, 4));
  if (prevAnios.length) {
    const m = prevAnios.reduce((s, [, v]) => s + v[0] + v[1], 0) / prevAnios.length;
    const anios = [...new Set(prevAnios.map(([k]) => k.slice(0, 4)))].join(' y ');
    out.push(`<div><div class="t">Media de los ${DIAS[ds].endsWith('s') ? DIAS[ds] : DIAS[ds] + 's'} de ${MESES[+mes - 1]} (${anios})</div><div class="v">${fmt(m)} personas</div><div class="d">${prevAnios.length} días, dato real sin eventos</div></div>`);
  }
  const hace = sumar(f, -364), v = D.historico[hace];
  if (v && v[0] !== null) {
    const [, m2, d2] = hace.split('-').map(Number);
    out.push(`<div><div class="t">Hace un año (${DIAS[dsem(hace)]} ${d2} de ${MESES[m2 - 1]} de ${hace.slice(0, 4)})</div><div class="v">${v[3] ? 'Cerrado' : fmt(v[0] + v[1]) + ' personas'}</div><div class="d">${v[3] ? '' : `${fmt(v[0])} comida + ${fmt(v[1])} cena`}</div></div>`);
  }
  return out.join('');
}
