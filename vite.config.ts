import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

const apiProxy = 'http://127.0.0.1:3001'

export default defineConfig(({ mode }) => {
  const isWeb = mode === 'web'
  return {
    base: isWeb ? '/' : '/telegram-card-game/',
    plugins: [
      react(),
      legacy({
        targets: ['defaults', 'not IE 11'],
      }),
      {
        name: 'gnh-web-pwa-head',
        transformIndexHtml(html: string) {
          if (!isWeb) return html
          const tags = [
            '    <link rel="manifest" href="/manifest.webmanifest" />',
            '    <meta name="mobile-web-app-capable" content="yes" />',
            '    <meta name="apple-mobile-web-app-capable" content="yes" />',
            '    <meta name="apple-mobile-web-app-title" content="GameNight" />',
            '    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
            '    <link rel="apple-touch-icon" href="/brand/pwa/apple-touch-icon.png" />',
            '    <link rel="icon" type="image/png" sizes="32x32" href="/brand/pwa/favicon-32.png" />',
            '    <link rel="icon" type="image/png" sizes="64x64" href="/brand/pwa/favicon-64.png" />',
            '    <meta name="theme-color" content="#2a1640" />',
          ].join('\n')
          return html
            .replace(/<link rel="icon"[^>]*>\s*/i, '')
            .replace('</head>', `${tags}\n  </head>`)
        },
      },
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
            '/api': { target: apiProxy, changeOrigin: true },
            '/legal': { target: apiProxy, changeOrigin: true },
            '/health': { target: apiProxy, changeOrigin: true },
          },
        }
      : undefined,
    preview: isWeb
      ? {
          proxy: {
            '/api': { target: apiProxy, changeOrigin: true },
            '/legal': { target: apiProxy, changeOrigin: true },
          },
        }
      : undefined,
  }
})
