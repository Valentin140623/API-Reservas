// Fechas siempre como 'AAAA-MM-DD', calculadas en UTC para evitar líos con el cambio de hora.
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const DIA_MS = 86400000;
export const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const ms = (s: string) => {
  const [a, m, d] = s.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
export const isoHoy = (ahora = new Date()) => iso(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
export const sumar = (s: string, n: number) => iso(ms(s) + n * DIA_MS);
export const dif = (a: string, b: string) => Math.round((ms(a) - ms(b)) / DIA_MS);
export const dsem = (s: string) => new Date(ms(s)).getUTCDay();
export const larga = (s: string) => {
  const [a, m, d] = s.split('-').map(Number);
  return `${DIAS[dsem(s)]} ${d} de ${MESES[m - 1]} de ${a}`;
};
export const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');
