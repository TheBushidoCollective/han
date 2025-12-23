import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import Pages from 'vite-plugin-pages';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['relay', { eagerEsModules: true }]],
      },
    }),
    Pages({
      dirs: 'src/pages',
      extensions: ['tsx'],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/graphql': {
        target: 'http://localhost:41956',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'out',
  },
});
