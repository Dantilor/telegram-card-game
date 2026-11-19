import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig(({ mode }) => {
  const isWeb = mode === 'web'
  return {
    base: isWeb ? '/' : '/telegram-card-game/',
    plugins: [
      react(),
      legacy({
        targets: ['defaults', 'not IE 11'],
      }),
    ],
    build: {
      target: 'es2018',
      assetsInlineLimit: 4096,
      outDir: isWeb ? 'dist-web' : 'dist',
      emptyOutDir: true,
    },
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __GNH_SHELL__: JSON.stringify(isWeb ? 'web' : 'telegram'),
      'import.meta.env.VITE_GNH_SHELL': JSON.stringify(isWeb ? 'web' : 'telegram'),
    },
    server: isWeb
      ? {
          proxy: {
            '/api': {
              target: process.env.GNH_API_PROXY || 'http://127.0.0.1:3001',
              changeOrigin: true,
            },
            '/legal': {
              target: process.env.GNH_API_PROXY || 'http://127.0.0.1:3001',
              changeOrigin: true,
            },
            '/health': {
              target: process.env.GNH_API_PROXY || 'http://127.0.0.1:3001',
              changeOrigin: true,
            },
          },
        }
      : undefined,
    preview: isWeb
      ? {
          // SPA fallback for BrowserRouter deep links during local preview.
          proxy: {
            '/api': {
              target: process.env.GNH_API_PROXY || 'http://127.0.0.1:3001',
              changeOrigin: true,
            },
            '/legal': {
              target: process.env.GNH_API_PROXY || 'http://127.0.0.1:3001',
              changeOrigin: true,
            },
          },
        }
      : undefined,
  }
})
