import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The public marketing site (landing + auth + docs). Separate from the admin SPA
// in web/ — different audience, different routing, no API proxy needed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'INVALID_ANNOTATION' && warning.id?.includes('@hugeicons/core-free-icons')) return;
        warn(warning);
      },
    },
  },
  server: { port: 5274 },
});
