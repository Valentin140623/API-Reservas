// Llamadas al backend (carpeta backend/). En desarrollo Vite reenvía /api a http://localhost:8000.
import type { DatosModelo } from '../motor';

export interface ResultadoImportacion { fichero: string; tipo: 'reservas' | 'turnos'; filas: number; desde: string; hasta: string; ignoradas: number }
export interface Rango { filas: number; desde: string | null; hasta: string | null }
export interface Estado { reservas: Rango; turnos: Rango }
export interface DiaResumen { fecha: string; comida: number | null; cena: number | null; reservadas: number; eventos: number; cerrado: boolean }
export interface InfoModelo { generado: string; datos_hasta: string; error_sin: number; media_test: number; error_res: Record<string, number>; dias: number }
export interface ResultadoReentreno { aplicado: boolean; antes: InfoModelo; despues: InfoModelo }
export interface Yo { email: string; restaurante: { id: number; nombre: string; lat: number; lon: number } }

/** Errores especiales: el backend no está arrancado, o la sesión no es válida. */
export const SIN_BACKEND = 'SIN_BACKEND';
export const SIN_SESION = 'SIN_SESION';

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, { credentials: 'same-origin', ...init });
  } catch {
    throw new Error(SIN_BACKEND);
  }
  if (r.status === 502 || r.status === 503 || r.status === 504) throw new Error(SIN_BACKEND);
  if (r.status === 401 && !url.endsWith('/login')) throw new Error(SIN_SESION);
  if (!r.ok) {
    const j = await r.json().catch(() => null);
    throw new Error(j?.detail ?? `Error ${r.status}`);
  }
  return r.json();
}

const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const api = {
  primeraVez: () => pedir<{ primera_vez: boolean }>('/api/primera-vez'),
  yo: () => pedir<Yo>('/api/yo'),
  login: (email: string, contrasena: string) => pedir<Yo>('/api/login', json({ email, contrasena })),
  registro: (email: string, contrasena: string, restaurante: string) => pedir<Yo>('/api/registro', json({ email, contrasena, restaurante })),
  logout: () => pedir<{ ok: boolean }>('/api/logout', { method: 'POST' }),
  modelo: () => pedir<DatosModelo>('/api/modelo'),
  modeloInfo: () => pedir<InfoModelo>('/api/modelo/info'),
  reentrenar: () => pedir<ResultadoReentreno>('/api/reentrenar', { method: 'POST' }),
  estado: () => pedir<Estado>('/api/estado'),
  dias: (desde: string, hasta: string) => pedir<DiaResumen[]>(`/api/dias?desde=${desde}&hasta=${hasta}`),
  importar: (ficheros: File[]) => {
    const fd = new FormData();
    ficheros.forEach(f => fd.append('ficheros', f));
    return pedir<ResultadoImportacion[]>('/api/importar', { method: 'POST', body: fd });
  },
};
