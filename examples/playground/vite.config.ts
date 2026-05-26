import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Force single instances of context-bearing singletons. pnpm can install
    // multiple physical copies of @wagmi/core (different peer-dep hashes); when
    // both get bundled, WagmiProvider and useConfig read different React
    // contexts and the app throws "useConfig must be used within WagmiProvider".
    dedupe: ['react', 'react-dom', 'wagmi', 'viem', '@tanstack/react-query'],
  },
  server: {
    allowedHosts: true,
  },
})
