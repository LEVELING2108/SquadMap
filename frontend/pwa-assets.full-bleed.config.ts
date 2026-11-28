import { defineConfig } from '@vite-pwa/assets-generator/config';

/**
 * Home-screen icons the phone crops into its own shape (Android maskable, Apple touch), from
 * public/icon-full-bleed.svg: the navy runs to every edge and the route sits inside the central safe zone
 * (a circle 80% wide), so no crop cuts it or shows a white corner.
 */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [] },
    maskable: { sizes: [512], padding: 0 },
    apple: { sizes: [180], padding: 0 },
  },
  images: ['public/icon-full-bleed.svg'],
});
