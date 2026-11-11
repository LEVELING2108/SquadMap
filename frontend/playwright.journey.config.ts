import { defineConfig, devices } from '@playwright/test';

/**
 * Full-stack browser tests: the web app talks to a real backend (:8480), database and mail
 * catcher. Start those first (make up, make backend); this config starts only the web app.
 */
const PORT = 5480;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e-journey',
  // One account flow at a time keeps the run easy to read and well inside the rate limits.
  workers: 1,
  forbidOnly: isCI,
  retries: 0,
  timeout: 90_000,
  reporter: isCI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report-journey' }]]
    : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: isCI ? 'retain-on-failure' : 'off',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
