import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/** The production policy, read from the Nginx file so the two can't drift apart. */
const CONF = fileURLToPath(new URL('../../infra/nginx/security-headers.conf', import.meta.url));
const POLICY = /add_header Content-Security-Policy "([^"]+)"/.exec(readFileSync(CONF, 'utf8'))?.[1];

/** Where the built app is served (playwright.csp.config.ts). */
const APP_ORIGIN = 'http://localhost:5484';

const user = {
  id: 'u1',
  name: 'Priya',
  email: 'priya@example.com',
  color: '#0F6E56',
  createdAt: '2026-11-01T10:00:00Z',
};

const settings = {
  darkMap: false,
  distanceUnit: 'km',
  defaultShareHours: 4,
  mapStyle: 'streets',
  chatDefault: true,
  reduceMotion: false,
  timeFormat: '12h',
  pushJoined: true,
  pushLeft: false,
  pushEndingSoon: true,
  pushTripEnded: true,
  preciseLocation: true,
  keepHistory: true,
};

/** Serves every page with the production policy, and records anything it blocks. */
async function underThePolicy(page: Page, signedIn: boolean) {
  expect(POLICY, 'policy found in security-headers.conf').toBeTruthy();
  await page.addInitScript(() => {
    (window as unknown as { blocked: string[] }).blocked = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { blocked: string[] }).blocked.push(
        `${event.violatedDirective} ${event.blockedURI}`,
      );
    });
  });
  await page.route(
    (url) => url.origin === APP_ORIGIN && !url.pathname.startsWith('/api/'),
    async (route) => {
      const response = await route.fetch();
      const headers = { ...response.headers(), 'content-security-policy': POLICY! };
      await route.fulfill({ response, headers });
    },
  );
  // No backend runs here: the API answers come from the test.
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill(
      signedIn ? json({ accessToken: 't', expiresIn: 900, user }) : json({ code: 'SESSION_EXPIRED' }, 401),
    ),
  );
  await page.route('**/api/v1/me/settings', (route) => route.fulfill(json(settings)));
  await page.route('**/api/v1/me/stats', (route) => route.fulfill(json({ trips: 3, friends: 2 })));
  await page.route('**/api/v1/me/alerts/unread-count', (route) => route.fulfill(json({ unread: 0 })));
  await page.route('**/api/v1/me/alerts?*', (route) =>
    route.fulfill(json({ items: [], nextBefore: null, unread: 0 })),
  );
  await page.route('**/api/v1/trips?status=active', (route) => route.fulfill(json([])));
  await page.route('**/api/v1/places/recent', (route) => route.fulfill(json([])));
  await page.route('**/api/v1/me/trips?*', (route) => route.fulfill(json({ items: [], nextBefore: null })));
}

async function expectNothingBlocked(page: Page) {
  // Give late requests (fonts, workers, the service worker) a moment.
  await page.waitForTimeout(800);
  const blocked = await page.evaluate(() => (window as unknown as { blocked: string[] }).blocked);
  expect(blocked).toEqual([]);
}

test.describe('the production Content-Security-Policy', () => {
  for (const path of ['/', '/login', '/signup', '/join', '/privacy']) {
    test(`blocks nothing on ${path}`, async ({ page }) => {
      await underThePolicy(page, false);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expectNothingBlocked(page);
    });
  }

  for (const path of ['/home', '/me', '/me/settings', '/me/alerts', '/me/history', '/me/privacy']) {
    test(`blocks nothing on ${path} when signed in`, async ({ page }) => {
      await underThePolicy(page, true);
      await page.goto(path);
      await expect(page.locator('main').first()).toBeVisible();
      await expectNothingBlocked(page);
    });
  }

  test('is really in force: something it forbids is blocked', async ({ page }) => {
    await underThePolicy(page, false);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

    await page.evaluate(() => {
      const image = document.createElement('img');
      image.src = 'https://example.com/tracker.png';
      document.body.append(image);
    });

    await expect
      .poll(() => page.evaluate(() => (window as unknown as { blocked: string[] }).blocked))
      .toContainEqual(expect.stringContaining('example.com'));
  });

  test('lets the offline worker start', async ({ page }) => {
    await underThePolicy(page, false);
    await page.goto('/');
    const active = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return Boolean(registration.active);
    });
    expect(active).toBe(true);
    await expectNothingBlocked(page);
  });
});
