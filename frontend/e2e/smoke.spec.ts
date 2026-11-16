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
  // Settings change for real within a test, so a saved choice shows up again.
  let settings = {
    darkMap: false,
    distanceUnit: 'km',
    defaultShareHours: 4,
    mapStyle: 'streets',
    chatDefault: true,
    reduceMotion: false,
    timeFormat: '12h',
  };
  await page.route('**/api/v1/me/settings', (route) => {
    if (route.request().method() === 'PATCH') {
      settings = { ...settings, ...(route.request().postDataJSON() as object) };
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(settings) });
  });
  await page.route('**/api/v1/me/colors', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(['#0F6E56', '#534AB7', '#993C1D', '#854F0B', '#993556']),
    }),
  );
  await page.route('**/api/v1/me/alerts/unread-count', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unread: 2 }) }),
  );
  await page.route('**/api/v1/me/stats', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ trips: 12, friends: 9 }),
    }),
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

/** A signed-in host planning a trip. Mapbox is blocked, so maps show their picture and tests stay offline. */
async function asHostPlanning(page: Page) {
  await asHostWithATrip(page);
  await page.route(/https:\/\/([a-z]+\.)?mapbox\.com\//, (route) => route.abort());
  await page.route('**/api/v1/places/recent', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: null,
          name: 'Lonavala Viewpoint',
          address: null,
          lat: 18.75,
          lng: 73.4,
          kind: 'recent',
          distanceMeters: null,
        },
      ]),
    }),
  );
  await page.route('**/api/v1/places/search?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'p1',
          name: 'Phoenix Marketcity',
          address: 'Viman Nagar, Pune, India',
          lat: 18.5622,
          lng: 73.9167,
          kind: 'poi',
          distanceMeters: 6200,
        },
        {
          id: 'p2',
          name: 'Pune',
          address: 'Maharashtra, India',
          lat: 18.52,
          lng: 73.85,
          kind: 'place',
          distanceMeters: 9100,
        },
        {
          id: 'p3',
          name: 'Pune Airport',
          address: 'Lohegaon, Pune, India',
          lat: 18.58,
          lng: 73.92,
          kind: 'poi',
          distanceMeters: 11000,
        },
      ]),
    }),
  );
}

test.describe('new trip screens', () => {
  const tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
  const violations = async (page: Page) =>
    (await new AxeBuilder({ page }).withTags(tags).analyze()).violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`,
    );

  async function tallEnough(page: Page) {
    for (const control of await page.locator('a:visible, button:visible, input:visible').all()) {
      const box = await control.boundingBox();
      const label = (await control.getAttribute('aria-label')) ?? (await control.textContent()) ?? 'control';
      expect(box?.height, label).toBeGreaterThanOrEqual(44);
    }
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`destination search has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      await asHostPlanning(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/trip/new/destination');
      await expect(page.getByRole('region', { name: 'RECENT' })).toBeVisible();
      expect(await violations(page)).toEqual([]);

      await page.getByLabel('Search for a place').fill('pune');
      await expect(page.getByRole('list', { name: 'Places found' }).getByRole('button')).toHaveCount(3);
      expect(await violations(page)).toEqual([]);
      await tallEnough(page);
    });

    test(`new trip has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      await asHostPlanning(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/trip/new/destination');
      await page.getByLabel('Search for a place').fill('phoenix');
      await page.getByRole('button', { name: /Phoenix Marketcity/ }).click();
      await expect(page.getByRole('heading', { name: 'Plan your trip' })).toBeVisible();
      await expect(page.getByRole('img', { name: 'Map showing Phoenix Marketcity' })).toBeVisible();

      expect(await violations(page)).toEqual([]);
      await tallEnough(page);
    });

    test(`choose on map has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      await asHostPlanning(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/trip/new/map');
      // Mapbox is blocked here, so the screen explains and offers search instead.
      await expect(page.getByRole('alert')).toContainText('The map couldn’t load here');

      expect(await violations(page)).toEqual([]);
      await tallEnough(page);
    });
  }

  test('the whole set-up works with the keyboard', async ({ page }) => {
    await asHostPlanning(page);
    await page.route('**/api/v1/trips', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(signedInTrip) })
        : route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([signedInTrip]),
          }),
    );
    await page.goto('/trip/new/destination');

    await page.keyboard.type('phoenix');
    const result = page.getByRole('button', { name: /Phoenix Marketcity/ });
    await expect(result).toBeVisible();
    await result.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Plan your trip' })).toBeVisible();

    await page.getByRole('radio', { name: '4 hours' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('radio', { name: '2 hours' })).toBeChecked();
    await page.getByRole('switch', { name: 'Friends can chat' }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('switch', { name: 'Friends can chat' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await page.getByRole('button', { name: 'Create trip and invite' }).focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/trip\/trip-1\/invite$/);
  });

  for (const width of [320, 390, 768]) {
    test(`no sideways scroll on the set-up screens at ${width} px`, async ({ page }) => {
      await asHostPlanning(page);
      await page.setViewportSize({ width, height: 800 });
      for (const path of ['/trip/new/destination', '/trip/new', '/trip/new/map']) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, path).toBe(0);
      }
    });
  }
});

const historyTrips = [
  {
    id: 'h1',
    name: 'Running now',
    destination: { name: 'Phoenix Marketcity', lat: 18.5622, lng: 73.9167 },
    startsAt: new Date().toISOString(),
    endedAt: null,
    status: 'active',
    role: 'host',
    friendCount: 1,
    friends: ['Aman'],
  },
  {
    id: 'h2',
    name: 'Saturday at Phoenix with a rather long name that has to be cut off somewhere',
    destination: { name: 'Phoenix Marketcity', lat: 18.5622, lng: 73.9167 },
    startsAt: '2026-10-12T10:00:00Z',
    endedAt: '2026-10-12T14:00:00Z',
    status: 'ended',
    role: 'host',
    friendCount: 4,
    friends: ['Aman', 'Sourav', 'Rohan', 'Meera'],
  },
  {
    id: 'h3',
    name: 'Airport pickup',
    destination: null,
    startsAt: '2026-09-02T10:00:00Z',
    endedAt: '2026-09-02T11:00:00Z',
    status: 'expired',
    role: 'member',
    friendCount: 2,
    friends: ['Aman', 'Priya'],
  },
];

/** A signed-in person with a few past trips. Mapbox is blocked, so thumbnails show the picture. */
async function withTripHistory(page: Page) {
  await asHostWithATrip(page);
  await page.route(/https:\/\/([a-z]+\.)?mapbox\.com\//, (route) => route.abort());
  await page.route('**/api/v1/me/trips?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: historyTrips, nextBefore: null }),
    }),
  );
  await page.route('**/api/v1/trips?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([signedInTrip]) }),
  );
}

test.describe('trip history', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      await withTripHistory(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/me/history');
      await expect(page.getByRole('list', { name: 'Trips' }).getByRole('listitem')).toHaveCount(3);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual(
        [],
      );
    });
  }

  test('every control is at least 44 px tall and nothing is hidden behind the navigation', async ({
    page,
  }) => {
    await withTripHistory(page);
    await page.goto('/me/history');
    await expect(page.getByRole('list', { name: 'Trips' }).getByRole('listitem')).toHaveCount(3);

    for (const control of await page.locator('a:visible, button:visible').all()) {
      const box = await control.boundingBox();
      const label = (await control.getAttribute('aria-label')) ?? (await control.textContent()) ?? 'control';
      expect(box?.height, label).toBeGreaterThanOrEqual(44);
    }
    // Scrolled to the end, the last card sits above the navigation bar.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const lastCard = await page
      .getByRole('list', { name: 'Trips' })
      .getByRole('listitem')
      .last()
      .boundingBox();
    const nav = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
    expect(lastCard!.y + lastCard!.height).toBeLessThanOrEqual(nav!.y);
  });

  test('the navigation moves between Explore and Trips', async ({ page }) => {
    await withTripHistory(page);
    await page.goto('/home');

    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Trips' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Trip history' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Trips' })).toHaveAttribute('aria-current', 'page');

    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Explore' }).click();
    await expect(page).toHaveURL(/\/home$/);
  });

  for (const width of [320, 390, 768]) {
    test(`no sideways scroll at ${width} px`, async ({ page }) => {
      await withTripHistory(page);
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/me/history');
      await expect(page.getByRole('list', { name: 'Trips' }).getByRole('listitem')).toHaveCount(3);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });
  }
});

test.describe('profile and settings', () => {
  const tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
  const violations = async (page: Page) =>
    (await new AxeBuilder({ page }).withTags(tags).analyze()).violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`,
    );

  for (const [name, path, heading] of [
    ['profile', '/me', 'Priya'],
    ['settings', '/me/settings', 'Settings'],
  ] as const) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${name} has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
        await asHostWithATrip(page);
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        if (name === 'profile') await expect(page.getByLabel('Your numbers')).toContainText('12');

        expect(await violations(page)).toEqual([]);
      });
    }

    test(`${name}: every control is at least 44 px tall`, async ({ page }) => {
      await asHostWithATrip(page);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();

      for (const control of await page.locator('a:visible, button:visible, label:visible:has(input)').all()) {
        const box = await control.boundingBox();
        const label =
          (await control.getAttribute('aria-label')) ?? (await control.textContent()) ?? 'control';
        expect(box?.height, label).toBeGreaterThanOrEqual(44);
      }
    });

    for (const width of [320, 390, 768]) {
      test(`${name}: no sideways scroll at ${width} px`, async ({ page }) => {
        await asHostWithATrip(page);
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBe(0);
      });
    }
  }

  test('settings can be changed with the keyboard and stay changed', async ({ page }) => {
    await asHostWithATrip(page);
    await page.goto('/me/settings');

    await page.getByRole('switch', { name: 'Dark map' }).focus();
    await page.keyboard.press('Space');
    await page.getByRole('radio', { name: 'Kilometres' }).focus();
    await page.keyboard.press('ArrowRight');
    await page.getByRole('radio', { name: '4 hours' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('radio', { name: '2 hours' })).toBeChecked();

    await page.reload();
    await expect(page.getByRole('switch', { name: 'Dark map' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'Miles' })).toBeChecked();
    await expect(page.getByRole('radio', { name: '2 hours' })).toBeChecked();
  });

  test('the You tab opens the profile, and its settings button opens settings', async ({ page }) => {
    await asHostWithATrip(page);
    await page.goto('/home');

    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'You' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Priya' })).toBeVisible();
    await page.getByRole('link', { name: 'Settings' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  });
});

test.describe('account screens', () => {
  const tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
  const violations = async (page: Page) =>
    (await new AxeBuilder({ page }).withTags(tags).analyze()).violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`,
    );

  for (const [name, path, heading] of [
    ['edit profile', '/me/edit', 'Edit profile'],
    ['change password', '/me/password', 'Change password'],
    ['change email', '/me/email', 'Change email'],
  ] as const) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${name} has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
        await asHostWithATrip(page);
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        if (name === 'edit profile') await expect(page.getByRole('radio')).toHaveCount(5);

        expect(await violations(page)).toEqual([]);
      });
    }

    test(`${name}: every control is at least 44 px tall, with no sideways scroll at 320 px`, async ({
      page,
    }) => {
      await asHostWithATrip(page);
      await page.setViewportSize({ width: 320, height: 720 });
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();

      for (const control of await page
        .locator(
          'a:visible, button:visible, input:visible:not([type=radio]), label:visible:has(input[type=radio])',
        )
        .all()) {
        const box = await control.boundingBox();
        const label =
          (await control.getAttribute('aria-label')) ?? (await control.textContent()) ?? 'control';
        expect(box?.height, label).toBeGreaterThanOrEqual(44);
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`the log out everywhere dialog has no accessibility violations in ${colorScheme} mode`, async ({
      page,
    }) => {
      await asHostWithATrip(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/me');
      await page.getByRole('button', { name: 'Log out everywhere else' }).click();
      await expect(page.getByRole('dialog', { name: 'Log out everywhere else?' })).toBeVisible();

      expect(await violations(page)).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(page.getByRole('button', { name: 'Log out everywhere else' })).toBeFocused();
    });
  }

  test('the colour can be picked with the keyboard', async ({ page }) => {
    await asHostWithATrip(page);
    await page.route('**/api/v1/me', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'u1',
              name: 'Priya',
              email: 'priya@example.com',
              color: '#534AB7',
              createdAt: '',
            }),
          })
        : route.fallback(),
    );
    await page.goto('/me/edit');
    await page.getByRole('radio', { name: 'Green' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Violet' })).toBeChecked();
    await page.getByRole('button', { name: 'Save' }).focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('status')).toContainText('Saved.');
  });

  test('Reduce animations stops the moving effects', async ({ page }) => {
    await asHostWithATrip(page);
    await page.goto('/me/settings');
    await page.getByRole('switch', { name: 'Reduce animations' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', '');

    await page.goto('/');
    const duration = await page
      .locator('.motion-drift')
      .first()
      .evaluate((element) => getComputedStyle(element).animationDuration);
    expect(parseFloat(duration)).toBeLessThan(0.001);
  });
});

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const sampleAlerts = [
  {
    id: 'a1',
    kind: 'member_joined',
    tripId: 'trip-1',
    tripName: 'Saturday at Phoenix',
    actorName: 'Rohan',
    actorColor: '#534AB7',
    createdAt: minutesAgo(2),
    read: false,
    tripLive: true,
  },
  {
    id: 'a2',
    kind: 'ending_soon',
    tripId: 'trip-1',
    tripName: 'Saturday at Phoenix',
    actorName: null,
    actorColor: null,
    createdAt: minutesAgo(8),
    read: false,
    tripLive: true,
  },
  {
    id: 'a3',
    kind: 'member_left',
    tripId: 'trip-1',
    tripName: 'Saturday at Phoenix',
    actorName: 'Aman',
    actorColor: '#993C1D',
    createdAt: '2026-11-10T10:00:00Z',
    read: true,
    tripLive: true,
  },
  {
    id: 'a4',
    kind: 'trip_ended',
    tripId: 'trip-0',
    tripName: 'Lonavala trip',
    actorName: null,
    actorColor: null,
    createdAt: '2026-10-12T10:00:00Z',
    read: true,
    tripLive: false,
  },
];

test.describe('alerts', () => {
  async function withAlerts(page: Page) {
    await asHostWithATrip(page);
    await page.route('**/api/v1/me/alerts?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: sampleAlerts, nextBefore: null, unread: 2 }),
      }),
    );
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      await withAlerts(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/me/alerts');
      await expect(page.getByRole('region', { name: 'Today' }).getByRole('button')).toHaveCount(2);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual(
        [],
      );
    });
  }

  test('every control is at least 44 px tall, with no sideways scroll at 320 px', async ({ page }) => {
    await withAlerts(page);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/me/alerts');
    await expect(page.getByRole('region', { name: 'Today' }).getByRole('button')).toHaveCount(2);

    for (const control of await page.locator('a:visible, button:visible').all()) {
      const box = await control.boundingBox();
      const label = (await control.getAttribute('aria-label')) ?? (await control.textContent()) ?? 'control';
      expect(box?.height, label).toBeGreaterThanOrEqual(44);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test('the Alerts tab shows the unread count on every main screen', async ({ page }) => {
    await withAlerts(page);
    for (const path of ['/home', '/me']) {
      await page.goto(path);
      await expect(
        page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Alerts, 2 unread' }),
      ).toBeVisible();
    }
  });

  test('an alert opens with the keyboard', async ({ page }) => {
    await withAlerts(page);
    await page.route('**/api/v1/me/alerts/a1/read', (route) => route.fulfill({ status: 204 }));
    await page.goto('/me/alerts');

    await page.getByRole('button', { name: /Rohan joined your trip/ }).focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/trip\/trip-1\/invite$/);
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
