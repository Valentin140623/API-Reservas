import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH lo pone el despliegue de GitHub Pages ("/nombre-del-repo/"); en local es "/".
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  // /api va al backend de Python (uvicorn en el puerto 8000)
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:8000' } },
});
