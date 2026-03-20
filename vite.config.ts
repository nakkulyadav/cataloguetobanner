import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/catalog': {
        target: 'https://prod.digihaat.in/analyticsDashboard/catalog',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/catalog/, ''),
      },
    },
  },
})