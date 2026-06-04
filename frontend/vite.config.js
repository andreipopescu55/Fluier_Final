import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),       // suport pentru JSX + Fast Refresh (hot reload)
    tailwindcss(), // pluginul oficial Tailwind v4 (proceseaza @import "tailwindcss")
  ],
  server: {
    port: 5173,
    // Proxy: orice cerere catre /api o trimitem la backend-ul FastAPI (port 8001).
    // Astfel frontend-ul si backend-ul par ca ruleaza pe acelasi origin -> fara probleme CORS in dev.
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
})
