import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // sockjs-client references the Node `global` object at module load time, which
  // is undefined in the browser and crashes the app. Map it to `globalThis`.
  define: {
    global: 'globalThis',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-512x512.png',
      ],
      manifest: {
        name: 'todly',
        short_name: 'todly',
        description: '함께 살아가는 하루, todly',
        lang: 'ko',
        theme_color: '#2E86E6',
        background_color: '#EDF1F7',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Offline app-shell: serve index.html for navigations that miss the cache.
        navigateFallback: 'index.html',
        // Don't hijack API or websocket navigations with the SPA shell.
        navigateFallbackDenylist: [/^\/api/, /^\/ws/],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // API GETs: try network first (fresh), fall back to cache offline.
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith('/api') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'todly-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Web fonts (Pretendard/Sora CSS + font files): stale-while-revalidate.
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com' ||
              url.origin === 'https://cdn.jsdelivr.net',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'todly-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
