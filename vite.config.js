import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    sourcemap: false,
  },
  server: {
    proxy: {
      '/henrik': {
        target: 'https://api.henrikdev.xyz',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/henrik/, ''),
      },
    },
  },
});
