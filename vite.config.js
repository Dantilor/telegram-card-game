import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
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
    },
    define: {
        __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
});
