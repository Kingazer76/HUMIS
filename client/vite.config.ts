import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5417,
    // Temporary public tunnels (Cloudflare) send a different Host header.
    // Allow it so friends can open the same Vite app without a host block.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5418',
        changeOrigin: true,
        timeout: 60_000,
      },
    },
  },
})
