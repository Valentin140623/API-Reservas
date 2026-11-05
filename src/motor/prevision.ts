import { predecirModelo } from './arboles';
import { dif, dsem, ms } from './fechas';
import type { DatosModelo, Prevision } from './tipos';

/** Fila de variables de calendario precalculadas para una fecha (undefined si está fuera de rango). */
export function filaCalendario(datos: DatosModelo, f: string): number[] | undefined {
  const i = Math.round((ms(f) - ms(datos.calendario.inicio)) / 86400000);
  return datos.calendario.filas[i];
}

/** Error medio esperado de las "nuevas" según los días de antelación. */
export function errorPara(datos: DatosModelo, h: number): number {
  const hs = Object.keys(datos.error_res).map(Number).sort((a, b) => a - b);
  let e = datos.error_res[hs[0]];
  for (const k of hs) if (k <= h) e = datos.error_res[k];
  return e;
}

/**
 * Previsión de personas para una fecha.
 * @param rc personas ya reservadas a comida (null si no se sabe)
 * @param rn personas ya reservadas a cena (null si no se sabe)
 * @param hoy fecha de hoy 'AAAA-MM-DD' (para calcular la antelación)
 */
export function prever(datos: DatosModelo, f: string, rc: number | null, rn: number | null, hoy: string): Prevision {
  if (f < datos.datos_hasta && datos.historico[f]) {
    const [c, n, reservadas, cerr] = datos.historico[f];
    return { tipo: 'pasado', fecha: f, comida: c, cena: n, reservadas, cerrado: !!cerr };
  }
  const cal = filaCalendario(datos, f);
  if (!cal) return { tipo: 'fuera', fecha: f };

  const conRes = rc !== null || rn !== null;
  const c0 = rc || 0;
  const n0 = rn || 0;
  let comida: number, cena: number, margen: number;
  if (conRes) {
    const h = Math.min(Math.max(dif(f, hoy), 0), 60);
    const x = cal.concat([c0, n0, c0 + n0, h]);
    comida = c0 + Math.max(0, Math.round(predecirModelo(datos.modelos.res_comida, x)));
    cena = n0 + Math.max(0, Math.round(predecirModelo(datos.modelos.res_cena, x)));
    margen = errorPara(datos, h);
  } else {
    comida = Math.round(predecirModelo(datos.modelos.sin_comida, cal));
    cena = Math.round(predecirModelo(datos.modelos.sin_cena, cal));
    margen = datos.error_sin;
  }

  // Días especiales (Nochebuena, San Valentín...): nunca menos de lo que vino otros años de media.
  const esp = datos.especiales[f.slice(5)];
  let especial: (typeof datos.especiales)[string] | null = null;
  if (esp && esp.anios.length) {
    const mc = esp.anios.reduce((s, a) => s + a[1], 0) / esp.anios.length;
    const mn = esp.anios.reduce((s, a) => s + a[2], 0) / esp.anios.length;
    comida = Math.max(comida, Math.round(mc));
    cena = Math.max(cena, Math.round(mn));
    especial = esp;
  }
  const festivo = datos.festivos[f] || null;
  return {
    tipo: 'prevision', fecha: f, conRes, rc: c0, rn: n0, comida, cena,
    nc: comida - c0, nn: cena - n0, margen, especial, festivo,
    lunes: dsem(f) === 1 && !festivo,
  };
}
