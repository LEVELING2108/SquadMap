import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const BACKEND = 'http://localhost:8480';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Our own small worker (src/sw/sw.ts), so push notifications can join it later.
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      // A new version waits for the person to tap Reload (src/pwa/UpdateToast.tsx).
      registerType: 'prompt',
      injectRegister: false,
      // The file list below already has every icon; listing them again would cache them twice.
      includeManifestIcons: false,
      // Off in `npm run dev`, so nothing gets stuck in a cache while working; on in the build.
      devOptions: { enabled: false },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // The source of the home-screen icons, which the app never loads, and the Atlas title font's
        // non-Latin files, fetched only if a title ever needs those letters.
        globIgnores: ['icon-full-bleed.svg', 'assets/fraunces-latin-ext-*', 'assets/fraunces-vietnamese-*'],
      },
      manifest: {
        name: 'SquadMap',
        short_name: 'SquadMap',
        description: 'Get there together. One link, one live map, everyone’s ETA.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1A73E8',
        background_color: '#F3EFE6',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Long-press the installed icon for these.
        shortcuts: [
          {
            name: 'Start a trip',
            url: '/trip/new',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Join with a code',
            url: '/join',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
    }),
  ],
  server: {
    port: 5480,
    strictPort: true,
    // The browser only ever talks to this dev server, so no CORS setup is needed locally.
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/ws': { target: BACKEND, changeOrigin: true, ws: true },
    },
  },
  // `npm run preview` serves the built app, with its service worker, the same way as the dev server.
  preview: {
    port: 5480,
    strictPort: true,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/ws': { target: BACKEND, changeOrigin: true, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
