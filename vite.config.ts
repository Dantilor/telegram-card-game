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
            '    <meta name="theme-color" content="#887099" media="(prefers-color-scheme: light)" />',
            '    <meta name="theme-color" content="#887099" media="(prefers-color-scheme: dark)" />',
            '    <meta name="theme-color" content="#887099" />',
          ].join('\n')
          return html
            .replace('<html lang="ru">', '<html lang="ru" data-gnh-shell="web">')
            .replace(/<meta name="theme-color"[^>]*>\s*/i, '')
            .replace(/<link rel="icon"[^>]*>\s*/i, '')
            // WEB: paint shell mauve before React — never flash neon-light #e8e6f5 (reads as white on iPhone).
            .replace(
              "if (!theme || !colors[theme]) theme = 'neon-light';\n        document.documentElement.dataset.theme = theme;\n        var bg = colors[theme];\n        document.documentElement.style.backgroundColor = bg;\n        document.body.style.backgroundColor = bg;",
              "if (!theme || !colors[theme]) theme = 'neon-light';\n        document.documentElement.dataset.theme = theme;\n        var bg = '#887099';\n        document.documentElement.style.backgroundColor = bg;\n        if (document.body) document.body.style.backgroundColor = bg;",
            )
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
