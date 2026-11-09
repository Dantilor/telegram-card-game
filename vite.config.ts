import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  base: '/telegram-card-game/',
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11'],
    }),
  ],
  build: {
    target: 'es2018',
    assetsInlineLimit: 4096,
    // Не раздувать cold start автоматическим modulepreload всех lazy-чанков из entry.
    modulePreload: {
      resolveDependencies: (_filename, deps) => deps.filter((dep) => !dep.includes('Layout') && !dep.includes('WhoIsWho') && !dep.includes('Sled')),
    },
    rollupOptions: {
      output: {
        // Хешированные ассеты безопасны для долгого кэша на CDN/хостинге.
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
