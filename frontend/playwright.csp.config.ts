import { defineConfig, devices } from '@playwright/test';

/**
 * Loads the built app (npm run build first) under the production Content-Security-Policy from
 * infra/nginx/security-headers.conf, and fails on anything the policy blocks. The dev server can't be used:
 * it injects inline scripts the production policy rightly refuses.
 */
const PORT = 5484;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e-csp',
  forbidOnly: isCI,
  reporter: isCI ? [['github']] : 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true },
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
