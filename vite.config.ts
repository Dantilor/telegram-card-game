import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { SEO_PAGES } from './src/seo/seoContent'
import { SEO_PAGE_CSS } from './src/seo/seoPageCss'
import {
  appShellHead,
  buildRobotsTxt,
  buildSeoManifest,
  buildSitemapXml,
  injectIntoShell,
  notFoundHead,
  pageHead,
  prerenderFileForPath,
  renderNotFoundBody,
  renderSeoPageBody,
  SEO_MANIFEST_FILE,
} from './src/seo/seoRender'

const apiProxy = 'http://127.0.0.1:3001'

/**
 * WEB-only static SEO output: prerendered public pages, noindex app shell, 404 page,
 * robots.txt, sitemap.xml and the manifest Express uses to pick the right HTML per path.
 */
function webSeoPrerender(): Plugin {
  return {
    name: 'gnh-web-seo-prerender',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const entry = bundle['index.html']
      if (!entry || entry.type !== 'asset') this.error('SEO prerender: index.html missing from bundle')
      const shell = String(entry.source)
      const emit = (fileName: string, source: string) => this.emitFile({ type: 'asset', fileName, source })
      const manifest = buildSeoManifest()
      // Home SPA replaces prerendered SEO captions immediately — hide them to avoid a one-frame flash.
      const homeSeoHide =
        '#root>.gnh-seo{opacity:0!important;pointer-events:none!important;position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important}'
      emit(manifest.appShell, injectIntoShell(shell, { head: appShellHead() }))
      emit(manifest.notFound, injectIntoShell(shell, { head: notFoundHead(), css: SEO_PAGE_CSS, body: renderNotFoundBody() }))
      for (const page of SEO_PAGES) {
        const css = page.kind === 'home' ? `${SEO_PAGE_CSS}${homeSeoHide}` : SEO_PAGE_CSS
        const html = injectIntoShell(shell, { head: pageHead(page), css, body: renderSeoPageBody(page) })
        const fileName = prerenderFileForPath(page.path)
        if (fileName === 'index.html') entry.source = html
        else emit(fileName, html)
      }
      emit('robots.txt', buildRobotsTxt())
      emit('sitemap.xml', buildSitemapXml())
      emit(SEO_MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`)
    },
  }
}

export default defineConfig(({ mode }) => {
  const isWeb = mode === 'web'
  return {
    base: isWeb ? '/' : '/telegram-card-game/',
    plugins: [
      react(),
      // Legacy polyfills only for Mini App WebViews — WEB modern browsers skip the ~1MB legacy chunk.
      ...(isWeb
        ? []
        : [
            legacy({
              targets: ['defaults', 'not IE 11'],
            }),
          ]),
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
      ...(isWeb ? [webSeoPrerender()] : []),
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
          watch: {
            ignored: ['**/playwright-report/**', '**/test-results/**', '**/artifacts/**'],
          },
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
