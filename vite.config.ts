import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['emblem.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Cataleya Cup 2026',
        short_name: 'Cataleya Cup',
        description: 'Raspored, rezultati uživo, tablice i ždrijeb.',
        lang: 'hr',
        start_url: '/',
        display: 'standalone',
        background_color: '#061a10',
        theme_color: '#061a10',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Podaci iz Supabasea: svježi kad ima signala, zadnji poznati kad nema.
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/'),
            handler: 'NetworkFirst',
            options: { cacheName: 'podaci', networkTimeoutSeconds: 4, expiration: { maxEntries: 200, maxAgeSeconds: 3 * 24 * 3600 } },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/storage/'),
            handler: 'CacheFirst',
            options: { cacheName: 'slike', expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 3600 } },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
