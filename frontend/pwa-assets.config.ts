import { defineConfig } from '@vite-pwa/assets-generator/config';

/**
 * Browser and install icons from public/favicon.svg, the rounded app icon (`npm run icons`). Home-screen
 * icons that the phone crops into its own shape come from public/icon-full-bleed.svg instead: see
 * pwa-assets.full-bleed.config.ts.
 */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']] },
    maskable: { sizes: [] },
    apple: { sizes: [] },
  },
  images: ['public/favicon.svg'],
});
