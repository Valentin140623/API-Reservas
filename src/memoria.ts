// Recordar la última consulta (solo en este navegador).
export interface Consulta { f: string; rc: string; rn: string }
export function guardar(c: Consulta) {
  try { localStorage.setItem('prevision', JSON.stringify(c)); } catch { /* sin almacenamiento */ }
}
export function recuperar(): Consulta | null {
  try { return JSON.parse(localStorage.getItem('prevision') || 'null'); } catch { return null; }
}
