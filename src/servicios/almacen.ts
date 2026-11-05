// Guarda el modelo en el propio navegador (IndexedDB), para la versión sin servidor.
// Nunca sale del dispositivo.
const BD = 'prevision', TABLA = 'modelo', CLAVE = 'actual';

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BD, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(TABLA);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}

async function operar<T>(modo: IDBTransactionMode, f: (t: IDBObjectStore) => IDBRequest): Promise<T> {
  const bd = await abrir();
  return new Promise((ok, mal) => {
    const r = f(bd.transaction(TABLA, modo).objectStore(TABLA));
    r.onsuccess = () => ok(r.result as T);
    r.onerror = () => mal(r.error);
  });
}

export async function leerModeloGuardado(): Promise<string | null> {
  try { return (await operar<string | undefined>('readonly', t => t.get(CLAVE))) ?? null; } catch { return null; }
}
export const guardarModelo = (texto: string) => operar('readwrite', t => t.put(texto, CLAVE));
export const borrarModelo = () => operar('readwrite', t => t.delete(CLAVE));
