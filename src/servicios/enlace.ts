// Modelo compartido por enlace: ?m=<usuario>/<id de gist> carga el modelo de un Gist de GitHub.
// La fuente se recuerda en el dispositivo para que, al volver a abrir la app, se actualice sola.
const CLAVE = 'fuente-modelo';

/** Convierte el parámetro del enlace en la URL del fichero (solo gists de GitHub). */
export function urlFuente(m: string): string | null {
  return /^[\w-]+\/[0-9a-f]{20,40}$/i.test(m) ? `https://gist.githubusercontent.com/${m}/raw` : null;
}

export function fuenteModelo(): string | null {
  const m = new URLSearchParams(location.search).get('m');
  try {
    if (m && urlFuente(m)) localStorage.setItem(CLAVE, m);
    return localStorage.getItem(CLAVE);
  } catch {
    return m && urlFuente(m) ? m : null;
  }
}

export function olvidarFuente() {
  try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
  const u = new URL(location.href);
  if (u.searchParams.has('m')) { u.searchParams.delete('m'); history.replaceState(null, '', u); }
}
