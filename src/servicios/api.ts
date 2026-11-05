// Llamadas al backend (carpeta backend/). En desarrollo Vite reenvía /api a http://localhost:8000.
export interface ResultadoImportacion { fichero: string; tipo: 'reservas' | 'turnos'; filas: number; desde: string; hasta: string; ignoradas: number }
export interface Rango { filas: number; desde: string | null; hasta: string | null }
export interface Estado { reservas: Rango; turnos: Rango }
export interface DiaResumen { fecha: string; comida: number | null; cena: number | null; reservadas: number; eventos: number; cerrado: boolean }

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, init);
  } catch {
    throw new Error('SIN_BACKEND');
  }
  if (r.status === 502 || r.status === 504) throw new Error('SIN_BACKEND');
  if (!r.ok) {
    const j = await r.json().catch(() => null);
    throw new Error(j?.detail ?? `Error ${r.status}`);
  }
  return r.json();
}

export const api = {
  estado: () => pedir<Estado>('/api/estado'),
  dias: (desde: string, hasta: string) => pedir<DiaResumen[]>(`/api/dias?desde=${desde}&hasta=${hasta}`),
  importar: (ficheros: File[]) => {
    const fd = new FormData();
    ficheros.forEach(f => fd.append('ficheros', f));
    return pedir<ResultadoImportacion[]>('/api/importar', { method: 'POST', body: fd });
  },
};
