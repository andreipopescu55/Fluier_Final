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
    // Portul poate fi suprascris prin variabila de mediu PORT (ex: preview-ul
    // din Claude Code ruleaza pe alt port, in paralel cu serverul tau de dev).
    // API-ul merge oricum prin proxy-ul de mai jos, deci portul nu conteaza.
    port: Number(process.env.PORT) || 5173,
    // host: true -> asculta pe toate interfetele (0.0.0.0), nu doar localhost.
    // Astfel alt calculator din aceeasi retea poate intra pe http://<IP-ul-tau>:5173.
    host: true,
    // allowedHosts: true -> accepta orice Host header (necesar pentru tunele
    // gen ngrok / cloudflared, care folosesc un domeniu public temporar).
    allowedHosts: true,
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
