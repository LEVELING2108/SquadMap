import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** No backend runs in these tests: answer the startup session check with "not signed in". */
async function withNoSession(page: Page) {
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      body: JSON.stringify({ status: 401, code: 'SESSION_EXPIRED', detail: 'Your session has ended.' }),
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await withNoSession(page);
});

test.describe('welcome screen', () => {
  test('loads with no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('401')) errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Get there together' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get started' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();

      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual(
        [],
      );
    });
  }

  test('every control is at least 44 px tall', async ({ page }) => {
    await page.goto('/');

    for (const link of await page.getByRole('link').all()) {
      const box = await link.boundingBox();
      expect(box?.height, (await link.textContent()) ?? 'link').toBeGreaterThanOrEqual(44);
    }
  });

  test('"Get started" leads to sign up', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Get started' }).click();

    await expect(page).toHaveURL(/\/signup$/);
  });
});

test.describe('theme', () => {
  test('follows a dark system setting before the app loads', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('a saved choice wins over the system setting', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(() => window.localStorage.setItem('squadmap.theme', 'dark'));
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('layout', () => {
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    test(`no sideways scroll at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });
  }

  test('shows the not-found page for an unknown path', async ({ page }) => {
    await page.goto('/no-such-page');

    await expect(page.getByRole('heading', { name: 'This page does not exist' })).toBeVisible();
  });
});
