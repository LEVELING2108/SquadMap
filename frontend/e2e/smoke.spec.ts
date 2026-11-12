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

const accountScreens = [
  ['log in', '/login', 'Welcome back'],
  ['sign up', '/signup', 'Create account'],
  ['forgot password', '/forgot', 'Lost your way?'],
  ['set a new password', '/reset-password#token=preview-token', 'Choose a new password'],
  ['expired reset link', '/reset-password', 'This link has expired'],
  ['home', '/home', 'You are exploring'],
] as const;

test.describe('account screens', () => {
  for (const [name, path, heading] of accountScreens) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${name} has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();

        expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual(
          [],
        );
      });
    }

    test(`${name}: every control is at least 44 px tall`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();

      for (const control of await page.locator('a, button, input:not([type=checkbox])').all()) {
        const box = await control.boundingBox();
        const label =
          (await control.getAttribute('aria-label')) ?? (await control.textContent()) ?? 'control';
        expect(box?.height, label).toBeGreaterThanOrEqual(44);
      }
    });
  }

  test('error messages are announced with their field after an empty submit', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByLabel('Name')).toHaveAccessibleDescription('Enter your name.');
    await expect(page.getByLabel('Name')).toBeFocused();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  test('the whole flow can be done with the keyboard', async ({ page }) => {
    await page.route('**/api/v1/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 't',
          expiresIn: 900,
          user: { id: 'u1', name: 'Priya', email: 'priya@example.com', color: '#0F6E56', createdAt: '' },
        }),
      }),
    );
    await page.goto('/login');

    await page.getByLabel('Email').focus();
    await page.keyboard.type('priya@example.com');
    await page.keyboard.press('Tab');
    await page.keyboard.type('correct horse');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'Hi, Priya' })).toBeVisible();
  });
});

const signedInTrip = {
  id: 'trip-1',
  name: 'Saturday at Phoenix',
  code: 'K7QX2P9T',
  inviteUrl: 'http://localhost:5480/join/K7QX2P9T',
  destination: { name: 'Phoenix Marketcity, Viman Nagar', lat: 18.5622, lng: 73.9167 },
  chatEnabled: true,
  startsAt: '2026-11-12T10:00:00Z',
  expiresAt: '2026-11-12T14:00:00Z',
  status: 'active',
  role: 'host',
  memberCount: 1,
};

/** A signed-in host with one trip, answered without a backend. */
async function asHostWithATrip(page: Page) {
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 't',
        expiresIn: 900,
        user: { id: 'u1', name: 'Priya', email: 'priya@example.com', color: '#0F6E56', createdAt: '' },
      }),
    }),
  );
  await page.route('**/api/v1/trips/trip-1', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(signedInTrip) }),
  );
}

test.describe('invite screen', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no accessibility violations in ${colorScheme} mode, with and without the QR dialog`, async ({
      page,
    }) => {
      await asHostWithATrip(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/trip/trip-1/invite');
      await expect(page.getByRole('heading', { name: 'Trip is live' })).toBeVisible();
      await expect(page.getByLabel('Trip code K 7 Q X 2 P 9 T')).toBeVisible();

      const tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
      const screen = await new AxeBuilder({ page }).withTags(tags).analyze();
      expect(screen.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);

      await page.getByRole('button', { name: 'QR code' }).click();
      await expect(page.getByRole('dialog', { name: 'Scan to join' })).toBeVisible();
      const dialog = await new AxeBuilder({ page }).withTags(tags).analyze();
      expect(dialog.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
    });
  }

  test('the QR dialog closes with Escape and returns focus', async ({ page }) => {
    await asHostWithATrip(page);
    await page.goto('/trip/trip-1/invite');
    const qr = page.getByRole('button', { name: 'QR code' });

    await qr.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(qr).toBeFocused();
  });

  test('every control is at least 44 px tall', async ({ page }) => {
    await asHostWithATrip(page);
    await page.goto('/trip/trip-1/invite');
    await expect(page.getByLabel('Trip code K 7 Q X 2 P 9 T')).toBeVisible();

    for (const control of await page.locator('a:visible, button:visible').all()) {
      const box = await control.boundingBox();
      const label = (await control.getAttribute('aria-label')) ?? (await control.textContent()) ?? 'control';
      expect(box?.height, label).toBeGreaterThanOrEqual(44);
    }
  });
});

const joinPreview = {
  code: 'K7QX2P9T',
  tripName: 'Saturday at Phoenix',
  hostName: 'Priya',
  destination: signedInTrip.destination,
  memberCount: 3,
  expiresAt: '2026-11-12T14:00:00Z',
};

/** Someone without an account opening an invite link; no backend runs. */
async function withAnInvite(page: Page) {
  await page.route('**/api/v1/join/K7QX2P9T/preview', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(joinPreview) }),
  );
}

const joinScreens = [
  ['join', '/join/K7QX2P9T', 'Join the trip'],
  ['expired link', '/join/expired?code=K7QX2P9T&ended=2026-11-12T10:00:00Z', 'This trip has ended'],
] as const;

test.describe('join screens', () => {
  const tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
  const violations = async (page: Page) =>
    (await new AxeBuilder({ page }).withTags(tags).analyze()).violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`,
    );

  for (const [name, path, heading] of joinScreens) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${name} has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
        await withAnInvite(page);
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        if (name === 'join') await expect(page.getByText('Saturday at Phoenix')).toBeVisible();

        expect(await violations(page)).toEqual([]);
      });
    }

    test(`${name}: every control is at least 44 px tall`, async ({ page }) => {
      await withAnInvite(page);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();

      for (const control of await page.locator('a:visible, button:visible, input:visible').all()) {
        const box = await control.boundingBox();
        const label =
          (await control.getAttribute('aria-label')) ?? (await control.textContent()) ?? 'control';
        expect(box?.height, label).toBeGreaterThanOrEqual(44);
      }
    });
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`consent has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      await withAnInvite(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/join/K7QX2P9T');
      await page.getByLabel('Your name').fill('Sourav');
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByRole('heading', { name: 'Share your live location?' })).toBeVisible();

      expect(await violations(page)).toEqual([]);
      for (const control of await page.locator('button:visible').all()) {
        expect(
          (await control.boundingBox())?.height,
          (await control.textContent()) ?? '',
        ).toBeGreaterThanOrEqual(44);
      }
    });

    test(`the QR scanner has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      // Someone who refuses the camera: the dialog explains what to do instead.
      await page.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = () =>
          Promise.reject(new DOMException('denied', 'NotAllowedError'));
      });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/join');
      await page.getByRole('button', { name: 'Scan QR code' }).click();
      const dialog = page.getByRole('dialog', { name: 'Scan the trip QR code' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('alert')).toContainText('Camera access is blocked');

      expect(await violations(page)).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('button', { name: 'Scan QR code' })).toBeFocused();
    });
  }
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
