import { defineConfig } from '@vite-pwa/assets-generator/config';

/**
 * App icons from the one source, public/favicon.svg (`npm run icons`). The rounded icon is used as it is;
 * home-screen icons that the phone crops into its own shape (maskable, Apple) sit on a full-bleed brand
 * blue, so the corners never show white. The pin stays inside the central safe zone either way.
 */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']] },
    maskable: { sizes: [512], padding: 0, resizeOptions: { background: '#1A73E8' } },
    apple: { sizes: [180], padding: 0, resizeOptions: { background: '#1A73E8' } },
  },
  images: ['public/favicon.svg'],
});
