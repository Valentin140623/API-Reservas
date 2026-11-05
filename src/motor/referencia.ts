import { DIAS, MESES, dsem, sumar } from './fechas';
import type { DatosModelo } from './tipos';

export interface Referencia {
  titulo: string;
  valor: string;
  detalle: string;
}

/** Lo que vino otros años en días comparables (solo días con asistencia real, desde oct-2024). */
export function referencia(datos: DatosModelo, f: string): Referencia[] {
  const ds = dsem(f);
  const mes = f.slice(5, 7);
  const out: Referencia[] = [];
  const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');
  const prevAnios = Object.entries(datos.historico).filter(
    ([k, v]) => v[0] !== null && !v[3] && k.slice(5, 7) === mes && dsem(k) === ds && k < f.slice(0, 4) + '-' + mes,
  );
  if (prevAnios.length) {
    const m = prevAnios.reduce((s, [, v]) => s + (v[0] ?? 0) + (v[1] ?? 0), 0) / prevAnios.length;
    const anios = [...new Set(prevAnios.map(([k]) => k.slice(0, 4)))].join(' y ');
    const plural = DIAS[ds].endsWith('s') ? DIAS[ds] : DIAS[ds] + 's';
    out.push({ titulo: `Media de los ${plural} de ${MESES[+mes - 1]} (${anios})`, valor: `${fmt(m)} personas`, detalle: `${prevAnios.length} días, dato real sin eventos` });
  }
  const hace = sumar(f, -364);
  const v = datos.historico[hace];
  if (v && v[0] !== null) {
    const [, m2, d2] = hace.split('-').map(Number);
    out.push({
      titulo: `Hace un año (${DIAS[dsem(hace)]} ${d2} de ${MESES[m2 - 1]} de ${hace.slice(0, 4)})`,
      valor: v[3] ? 'Cerrado' : fmt(v[0] + (v[1] ?? 0)) + ' personas',
      detalle: v[3] ? '' : `${fmt(v[0])} comida + ${fmt(v[1] ?? 0)} cena`,
    });
  }
  return out;
}
