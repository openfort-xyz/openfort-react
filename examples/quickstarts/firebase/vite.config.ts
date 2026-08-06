import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // The proxy only makes sense for a path-style endpoint (`/api/...`). The
  // scaffolder can rewrite the endpoint to a full URL, which the SDK fetches
  // directly — a proxy keyed on an absolute URL would never match anyway.
  const endpoint = env.VITE_CREATE_ENCRYPTED_SESSION_ENDPOINT
  const proxy = endpoint?.startsWith('/')
    ? {
        [endpoint]: {
          target: env.VITE_CREATE_ENCRYPTED_SESSION_BASE_URL,
          changeOrigin: true,
          secure: false,
        },
      }
    : undefined

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom', 'wagmi', 'viem', '@tanstack/react-query'],
    },
    server: { proxy },
  }
})
