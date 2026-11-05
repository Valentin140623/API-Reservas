/**
 * "navegador": versión sin servidor (GitHub Pages). Todo funciona en el propio móvil u ordenador:
 * la previsión usa un modelo guardado en el navegador (el de demostración o el que cargues tú).
 * Se activa compilando con VITE_MODO=navegador.
 */
export const MODO_NAVEGADOR = import.meta.env.VITE_MODO === 'navegador';

/** Enlace de la versión sin servidor (GitHub Pages), para compartir el modelo con compañeros. */
export const URL_MOVIL: string = import.meta.env.VITE_URL_MOVIL || 'https://valentin140623.github.io/Prevision-de-reservas/';

/** true si la app completa está en internet (no en localhost): ahí tiene sentido invitar compañeros. */
export const EN_INTERNET = !['localhost', '127.0.0.1'].includes(location.hostname);
