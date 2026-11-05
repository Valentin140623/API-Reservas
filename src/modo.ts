/**
 * "navegador": versión sin servidor (GitHub Pages). Todo funciona en el propio móvil u ordenador:
 * la previsión usa un modelo guardado en el navegador (el de demostración o el que cargues tú).
 * Se activa compilando con VITE_MODO=navegador.
 */
export const MODO_NAVEGADOR = import.meta.env.VITE_MODO === 'navegador';
