import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH lo pone el despliegue de GitHub Pages ("/nombre-del-repo/"); en local es "/".
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
});
