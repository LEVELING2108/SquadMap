import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

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
  // Calls a test doesn't answer fail as if no backend were running, even when one is running locally;
  // otherwise its real answers (say, rejecting a test's made-up token) would change what the test sees.
  // Routes added later take precedence, so every test's own answers still apply.
  await page.route('**/api/v1/**', (route) => route.abort());
  await withNoSession(page);
  // No test depends on Mapbox: maps show their picture, and nothing reaches the network.
  await page.route(/https:\/\/([a-z]+\.)?mapbox\.com\//, (route) => route.abort());
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
  ['home', '/home', 'Ready for a trip?'],
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

    await expect(page.getByRole('link', { name: 'Your profile, Priya' })).toBeVisible();
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
    pushJoined: true,
    pushLeft: false,
    pushEndingSoon: true,
    pushTripEnded: true,
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
    // Typing starts once the search box is there and focused, as it is for a person.
    await expect(page.getByLabel('Search for a place')).toBeFocused();

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

/**
 * Stands in for the browser's push support. The dev server runs without the offline worker, so this
 * fakes one with push: the permission as given, and the answer to the browser's question.
 */
async function fakePush(
  page: Page,
  {
    permission,
    answer = 'granted',
    subscribed = false,
  }: { permission: string; answer?: string; subscribed?: boolean },
) {
  await page.addInitScript(
    ({ permission, answer, subscribed }) => {
      const state = { permission, subscribed };
      const subscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/e2e',
        options: { applicationServerKey: null },
        toJSON: () => ({
          endpoint: 'https://fcm.googleapis.com/fcm/send/e2e',
          keys: { p256dh: 'p', auth: 'a' },
        }),
        unsubscribe: async () => {
          state.subscribed = false;
          return true;
        },
      };
      const pushManager = {
        getSubscription: async () => (state.subscribed ? subscription : null),
        subscribe: async () => {
          state.subscribed = true;
          return subscription;
        },
      };
      Object.defineProperty(window, 'PushManager', { value: function PushManager() {}, configurable: true });
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: Object.defineProperties(function Notification() {}, {
          permission: { get: () => state.permission },
          requestPermission: {
            value: async () => {
              state.permission = answer;
              return answer;
            },
          },
        }),
      });
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: Object.assign(new EventTarget(), {
          getRegistration: async () => ({ active: {}, pushManager }),
        }),
      });
    },
    { permission, answer, subscribed },
  );
}

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
    await page.route('**/api/v1/me/push/key', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          publicKey:
            'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
        }),
      }),
    );
    await page.route('**/api/v1/me/push/*subscribe', (route) => route.fulfill({ status: 204 }));
    // Notifications already on, so the checks below include every push switch.
    await fakePush(page, { permission: 'granted', subscribed: true });
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

  test('the push switches follow what was chosen', async ({ page }) => {
    await withAlerts(page);
    await page.goto('/me/alerts');

    const push = page.getByRole('region', { name: 'PUSH ALERTS' });
    await expect(push.getByRole('switch', { name: 'Notifications on this device' })).toBeChecked();
    await expect(push.getByRole('switch', { name: 'Friend joins' })).toBeChecked();
    await expect(push.getByRole('switch', { name: 'Friend leaves' })).not.toBeChecked();

    await push.getByRole('switch', { name: 'Friend leaves' }).click();
    await expect(push.getByRole('switch', { name: 'Friend leaves' })).toBeChecked();
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Friend leaves' })).toBeChecked();
  });

  test('turning notifications on asks the browser, then tells the server', async ({ page }) => {
    await withAlerts(page);
    await fakePush(page, { permission: 'default', answer: 'granted' });
    await page.goto('/me/alerts');

    const subscribed = page.waitForRequest('**/api/v1/me/push/subscribe');
    await page.getByRole('switch', { name: 'Notifications on this device' }).click();

    expect((await subscribed).postDataJSON()).toMatchObject({
      endpoint: 'https://fcm.googleapis.com/fcm/send/e2e',
    });
    await expect(page.getByRole('switch', { name: 'Notifications on this device' })).toBeChecked();
    await expect(page.getByRole('switch', { name: 'Trip ended' })).toBeVisible();
  });

  test('when the browser says no, explains how to allow them', async ({ page }) => {
    await withAlerts(page);
    await fakePush(page, { permission: 'default', answer: 'denied' });
    await page.goto('/me/alerts');

    await page.getByRole('switch', { name: 'Notifications on this device' }).click();

    await expect(page.getByText(/Notifications are blocked for SquadMap/)).toBeVisible();
  });

  test('Settings leads to the push switches', async ({ page }) => {
    await withAlerts(page);
    await page.goto('/me/settings');

    await page.getByRole('link', { name: /Push notifications/ }).click();

    await expect(page).toHaveURL(/\/me\/alerts#push$/);
    await expect(page.getByRole('switch', { name: 'Notifications on this device' })).toBeInViewport();
  });
});

test.describe('home with the map', () => {
  async function asHostOnHome(page: Page) {
    await asHostWithATrip(page);
    await page.route('**/api/v1/trips?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ ...signedInTrip, memberCount: 4 }]),
      }),
    );
    await page.route('**/api/v1/places/recent', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`signed in, it has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      await asHostOnHome(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/home');
      await expect(page.getByRole('link', { name: /Live now · 3 friends/ })).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual(
        [],
      );
    });
  }

  test('signed in, every control is at least 44 px tall', async ({ page }) => {
    await asHostOnHome(page);
    await page.goto('/home');
    await expect(page.getByRole('link', { name: /Live now/ })).toBeVisible();

    for (const control of await page.locator('a:visible, button:visible').all()) {
      const box = await control.boundingBox();
      const label = (await control.getAttribute('aria-label')) ?? (await control.textContent()) ?? 'control';
      expect(box?.height, label).toBeGreaterThanOrEqual(44);
    }
  });

  for (const width of [320, 390, 768]) {
    test(`signed in, nothing overlaps or scrolls sideways at ${width} px`, async ({ page }) => {
      await asHostOnHome(page);
      await page.setViewportSize({ width, height: 740 });
      await page.goto('/home');
      await expect(page.getByRole('link', { name: /Live now/ })).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
      // The panel sits above the navigation, and the recenter button above the panel.
      const panel = (await page.getByRole('region', { name: 'Ready for a trip?' }).boundingBox())!;
      const nav = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!;
      const locate = (await page.getByRole('button', { name: 'Show where I am' }).boundingBox())!;
      expect(panel.y + panel.height).toBeLessThanOrEqual(nav.y + 1);
      expect(locate.y + locate.height).toBeLessThanOrEqual(panel.y);
    });
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`with cafes shown, it has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      await asHostOnHome(page);
      await page.route('**/api/v1/places/nearby?*', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'c1',
              name: 'Cafe Chopped Leaf',
              address: 'Rose Garden Society, Pune',
              lat: 18.5684,
              lng: 73.9145,
              kind: 'cafes',
              distanceMeters: 60,
            },
            {
              id: 'c2',
              name: 'Alag Aasmaan',
              address: 'Bhakti Apartments, Pune',
              lat: 18.569,
              lng: 73.915,
              kind: 'cafes',
              distanceMeters: 1200,
            },
          ]),
        }),
      );
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/home');
      await page.getByRole('button', { name: 'Cafes' }).click();
      // The pressed chip is solid blue: the scan can't judge contrast on see-through glass, so check it.
      const chip = await page.getByRole('button', { name: 'Cafes', exact: true }).evaluate((element) => {
        const probe = document.createElement('div');
        probe.style.backgroundColor = 'var(--blue)';
        document.body.append(probe);
        const blue = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return { background: getComputedStyle(element).backgroundColor, blue };
      });
      expect(chip.background).toBe(chip.blue);
      await page.getByRole('button', { name: /Cafe Chopped Leaf/ }).click();
      await expect(page.getByRole('button', { name: 'Plan a trip here' })).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual(
        [],
      );
      for (const control of await page.locator('a:visible, button:visible').all()) {
        const box = await control.boundingBox();
        const label =
          (await control.getAttribute('aria-label')) ?? (await control.textContent()) ?? 'control';
        expect(box?.height, label).toBeGreaterThanOrEqual(44);
      }
    });
  }

  test('the top bar works with the keyboard', async ({ page }) => {
    await asHostOnHome(page);
    await page.goto('/home');
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();

    await page.getByRole('link', { name: /Where to\?/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/trip\/new\/destination$/);
  });

  test('never asks for location on its own', async ({ page, context }) => {
    await context.clearPermissions();
    await asHostOnHome(page);
    await page.addInitScript(() => {
      (window as unknown as { asked: number }).asked = 0;
      const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (...args) => {
        (window as unknown as { asked: number }).asked += 1;
        original(...args);
      };
    });
    await page.goto('/home');
    await expect(page.getByRole('link', { name: /Live now/ })).toBeVisible();
    await page.waitForTimeout(500);

    expect(await page.evaluate(() => (window as unknown as { asked: number }).asked)).toBe(0);
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

/**
 * Plays the server's side of the live connection: answers CONNECT, remembers subscriptions, and lets a
 * test push messages to the page or drop the connection.
 */
/** How the sample trip went, for the host (GET /trips/trip-1/summary). */
const sampleSummary = {
  id: 'trip-1',
  name: 'Saturday at Phoenix',
  destination: { name: 'Phoenix Marketcity, Viman Nagar', lat: 18.5622, lng: 73.9167 },
  status: 'ended',
  role: 'host',
  startsAt: '2026-11-19T13:10:00Z',
  endedAt: '2026-11-19T13:29:00Z',
  durationSeconds: 1140,
  friendCount: 2,
  distanceM: 8100,
  arrivedAt: null,
};

async function fakeLiveServer(page: Page) {
  const subscriptions = new Map<string, string>();
  let socket: import('@playwright/test').WebSocketRoute | null = null;
  let messages = 0;
  const frame = (command: string, headers: Record<string, string>, body = '') =>
    `${command}\n${Object.entries(headers)
      .map(([key, value]) => `${key}:${value}`)
      .join('\n')}\n\n${body}\0`;
  let down = false;
  await page.routeWebSocket('**/ws/websocket', (ws) => {
    // While the server is down, every attempt to connect fails straight away.
    if (down) {
      void ws.close();
      return;
    }
    socket = ws;
    ws.onMessage((data) => {
      for (const raw of String(data).split('\0')) {
        const text = raw.replace(/^\n+/, '');
        if (!text) continue;
        const [head = ''] = text.split('\n\n');
        const [command, ...lines] = head.split('\n');
        const headers = Object.fromEntries(
          lines.map((line) => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1)]),
        );
        if (command === 'CONNECT' || command === 'STOMP')
          ws.send(frame('CONNECTED', { version: '1.2', 'heart-beat': '0,0' }));
        if (command === 'SUBSCRIBE') subscriptions.set(headers.destination!, headers.id!);
      }
    });
  });
  return {
    connected: () => subscriptions.size >= 3,
    send(destination: string, payload: unknown) {
      const id = subscriptions.get(destination);
      if (!socket || !id) throw new Error(`Not subscribed to ${destination}`);
      messages += 1;
      socket.send(
        frame(
          'MESSAGE',
          { destination, subscription: id, 'message-id': `m${messages}`, 'content-type': 'application/json' },
          JSON.stringify(payload),
        ),
      );
    },
    /** The connection drops and no new one can be made until comeBack(). */
    async goDown() {
      down = true;
      subscriptions.clear();
      await socket?.close();
    },
    comeBack() {
      down = false;
    },
  };
}

/** The host on their trip with Aman (sharing, with a spot) and Rohan (not sharing yet). */
async function asHostOnTheLiveMap(page: Page) {
  await asHostWithATrip(page);
  await page.route('**/api/v1/trips/trip-1/summary', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sampleSummary),
    }),
  );
  await page.route('**/api/v1/trips/trip-1/members', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          memberId: 'm-priya',
          displayName: 'Priya',
          color: '#0F6E56',
          role: 'host',
          you: true,
          sharing: false,
          location: null,
        },
        {
          memberId: 'm-aman',
          displayName: 'Aman',
          color: '#993C1D',
          role: 'member',
          you: false,
          sharing: true,
          location: { lat: 18.56, lng: 73.91, acc: 10, ts: new Date().toISOString() },
        },
        {
          memberId: 'm-rohan',
          displayName: 'Rohan',
          color: '#534AB7',
          role: 'member',
          you: false,
          sharing: false,
          location: null,
        },
      ]),
    }),
  );
  await page.route('**/api/v1/trips/trip-1/eta', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          memberId: 'm-aman',
          distanceM: 1600,
          durationS: 240,
          mode: 'car',
          progress: 0.4,
          estimated: false,
          computedAt: new Date().toISOString(),
        },
      ]),
    }),
  );
  return fakeLiveServer(page);
}

test.describe('live map', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      const server = await asHostOnTheLiveMap(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/trip/trip-1');
      await expect(page.getByRole('heading', { name: '2 friends on the way' })).toBeVisible();
      await expect.poll(server.connected).toBe(true);
      await expect(page.getByText(/^Live · /)).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual(
        [],
      );
      for (const control of await page.locator('a:visible, button:visible').all()) {
        const box = await control.boundingBox();
        const label =
          (await control.getAttribute('aria-label')) ?? (await control.textContent()) ?? 'control';
        expect(box?.height, label).toBeGreaterThanOrEqual(44);
      }
    });
  }

  test('shows a friend’s move and who joined, as they happen', async ({ page }) => {
    const server = await asHostOnTheLiveMap(page);
    await page.goto('/trip/trip-1');
    await expect.poll(server.connected).toBe(true);
    const friends = page.getByRole('list', { name: 'Friends on this trip' });
    const old = new Date(Date.now() - 5 * 60_000).toISOString();

    server.send('/topic/trip.trip-1.locations', {
      memberId: 'm-aman',
      lat: 18.561,
      lng: 73.911,
      acc: 9,
      ts: old,
    });
    // A reading older than the one shown is ignored: Aman stays live.
    await expect(friends.getByText('Aman, live on the map')).toBeAttached();
    server.send('/topic/trip.trip-1.events', {
      type: 'MEMBER_JOINED',
      memberId: 'm-sara',
      displayName: 'Sara',
      at: '',
    });

    await expect(page.getByText('Sara joined the trip')).toBeVisible();
  });

  test('says when the connection is lost, and Retry brings it back', async ({ page }) => {
    const server = await asHostOnTheLiveMap(page);
    await page.goto('/trip/trip-1');
    await expect.poll(server.connected).toBe(true);

    await server.goDown();

    await expect(page.getByText('No connection, showing last known spots')).toBeVisible({ timeout: 10_000 });
    server.comeBack();
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect.poll(server.connected).toBe(true);
    await expect(page.getByText('No connection, showing last known spots')).toBeHidden();
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`"Who’s on the way" has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      const server = await asHostOnTheLiveMap(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/trip/trip-1');
      await expect(page.getByText('Next: Aman in 4 min · by car')).toBeVisible();
      await expect.poll(server.connected).toBe(true);

      await page.getByRole('link', { name: 'Who’s on the way' }).click();
      await expect(page.getByRole('heading', { name: 'Who’s on the way' })).toBeVisible();
      await expect(page).toHaveURL(/\/trip\/trip-1\/eta$/);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual(
        [],
      );
      for (const control of await page.locator('a:visible, button:visible').all()) {
        const box = await control.boundingBox();
        const label =
          (await control.getAttribute('aria-label')) ?? (await control.textContent()) ?? 'control';
        expect(box?.height, label).toBeGreaterThanOrEqual(44);
      }
    });
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`a friend’s details and the map style menu have no accessibility violations in ${colorScheme} mode`, async ({
      page,
    }) => {
      const server = await asHostOnTheLiveMap(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/trip/trip-1/friend/m-aman');
      await expect(page.getByRole('heading', { name: 'Aman' })).toBeVisible();
      await expect.poll(server.connected).toBe(true);
      await page.getByRole('button', { name: 'Map style' }).click();
      await expect(page.getByRole('group', { name: 'Map style' })).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual(
        [],
      );
      for (const control of await page.locator('a:visible, button:visible').all()) {
        const box = await control.boundingBox();
        const label =
          (await control.getAttribute('aria-label')) ?? (await control.textContent()) ?? 'control';
        expect(box?.height, label).toBeGreaterThanOrEqual(44);
      }
    });
  }

  test('a friend’s details open from the list with the keyboard, and Follow works', async ({ page }) => {
    const server = await asHostOnTheLiveMap(page);
    await page.goto('/trip/trip-1/eta');
    await expect.poll(server.connected).toBe(true);

    await page.getByRole('link', { name: /Aman/ }).focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/trip\/trip-1\/friend\/m-aman$/);
    await expect(page.getByRole('heading', { name: 'Aman' })).toBeVisible();
    await page.getByRole('button', { name: 'Follow' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Following Aman')).toBeVisible();
    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(page.getByText('Following Aman')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Directions to Aman' })).toHaveAttribute(
      'href',
      /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=18\.56,73\.91&travelmode=driving$/,
    );
  });

  test('shows a new ETA and an arrival as they happen', async ({ page }) => {
    const server = await asHostOnTheLiveMap(page);
    await page.goto('/trip/trip-1');
    await expect.poll(server.connected).toBe(true);

    server.send('/topic/trip.trip-1.eta', {
      memberId: 'm-aman',
      distanceM: 400,
      durationS: 70,
      mode: 'walk',
      progress: 0.9,
      estimated: false,
      computedAt: new Date(Date.now() + 1000).toISOString(),
    });
    await expect(page.getByText('Next: Aman in 1 min · on foot')).toBeVisible();

    server.send('/topic/trip.trip-1.events', {
      type: 'ARRIVED',
      memberId: 'm-aman',
      displayName: 'Aman',
      at: '',
    });
    await expect(page.getByText('Aman arrived at Phoenix Marketcity')).toBeVisible();
  });

  test('ends for everyone when the host ends the trip', async ({ page }) => {
    const server = await asHostOnTheLiveMap(page);
    await page.goto('/trip/trip-1');
    await expect.poll(server.connected).toBe(true);

    server.send('/topic/trip.trip-1.events', { type: 'TRIP_ENDED', at: '' });

    await expect(page).toHaveURL(/\/trip\/trip-1\/ended$/);
    await expect(page.getByRole('heading', { name: 'Trip complete' })).toBeVisible();
  });

  for (const width of [320, 390, 768]) {
    test(`fits ${width} px without sideways scroll`, async ({ page }) => {
      await asHostOnTheLiveMap(page);
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/trip/trip-1');
      await expect(page.getByRole('heading', { name: '2 friends on the way' })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });
  }
});

/** The live map with a chat: two messages, one of them unread, and a server that takes new ones. */
async function asHostWithAChat(page: Page) {
  const server = await asHostOnTheLiveMap(page);
  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  const sent: { text: string; clientId: string }[] = [];
  await page.route(/\/api\/v1\/trips\/trip-1\/messages(\/read)?(\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.url().endsWith('/read')) return route.fulfill({ status: 204 });
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as { text: string; clientId: string };
      sent.push(body);
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: `c-${sent.length + 10}`,
          memberId: 'm-priya',
          displayName: 'Priya',
          color: '#0F6E56',
          sentAt: new Date().toISOString(),
          ...body,
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'c-2',
            memberId: 'm-aman',
            displayName: 'Aman',
            color: '#993C1D',
            text: 'Stuck at the signal, 10 min',
            sentAt: minutesAgo(2),
          },
          {
            id: 'c-1',
            memberId: 'm-priya',
            displayName: 'Priya',
            color: '#0F6E56',
            text: 'Save me a seat please',
            sentAt: minutesAgo(5),
          },
        ],
        nextBefore: null,
        unread: 1,
        memberId: 'm-priya',
      }),
    });
  });
  return { server, sent };
}

test.describe('trip chat', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      const { server } = await asHostWithAChat(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/trip/trip-1/chat');
      await expect(page.getByText('Stuck at the signal, 10 min')).toBeVisible();
      await expect.poll(server.connected).toBe(true);
      server.send('/topic/trip.trip-1.chat', { type: 'TYPING', memberId: 'm-aman', at: '' });
      await expect(page.getByText('Aman is typing')).toBeAttached();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual(
        [],
      );
      for (const control of await page.locator('a:visible, button:visible').all()) {
        const box = await control.boundingBox();
        const label =
          (await control.getAttribute('aria-label')) ?? (await control.textContent()) ?? 'control';
        expect(box?.height, label).toBeGreaterThanOrEqual(44);
      }
    });
  }

  test('opens from the map, where it shows what is unread, and works with the keyboard', async ({ page }) => {
    const { server, sent } = await asHostWithAChat(page);
    await page.goto('/trip/trip-1');
    await expect.poll(server.connected).toBe(true);

    await page.getByRole('link', { name: 'Trip chat, 1 unread' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/trip\/trip-1\/chat$/);
    await expect(page.getByText('3 friends')).toBeVisible();

    await page.getByRole('textbox', { name: 'Message' }).focus();
    await page.keyboard.type('On my way');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('log').getByText('On my way')).toBeVisible();
    expect(sent.map((message) => message.text)).toEqual(['On my way']);

    server.send('/topic/trip.trip-1.chat', {
      type: 'MESSAGE',
      message: {
        id: 'c-30',
        memberId: 'm-aman',
        displayName: 'Aman',
        color: '#993C1D',
        text: 'Reached. Table near the entrance',
        sentAt: new Date().toISOString(),
      },
      at: '',
    });
    await expect(page.getByText('Reached. Table near the entrance')).toBeVisible();

    await page.getByRole('link', { name: 'Back to the map' }).click();
    await expect(page.getByRole('link', { name: 'Trip chat', exact: true })).toBeVisible();
  });

  for (const width of [320, 390, 768]) {
    test(`fits ${width} px without sideways scroll`, async ({ page }) => {
      await asHostWithAChat(page);
      await page.setViewportSize({ width, height: 700 });
      await page.goto('/trip/trip-1/chat');
      await expect(page.getByText('Stuck at the signal, 10 min')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
      await expect(page.getByRole('button', { name: 'Send' })).toBeInViewport();
    });
  }
});

/** The live map with a trip that has `leftMs` to go, and extend and end answered like the server would. */
async function asHostWithAMenu(page: Page, leftMs = 3 * 3_600_000, role: 'host' | 'member' = 'host') {
  const server = await asHostOnTheLiveMap(page);
  const now = Date.now();
  let trip = {
    ...signedInTrip,
    role,
    startsAt: new Date(now - 3_600_000).toISOString(),
    expiresAt: new Date(now + leftMs).toISOString(),
  };
  const answer = (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(trip) });
  await page.route('**/api/v1/trips/trip-1', answer);
  await page.route('**/api/v1/trips/trip-1/extend', (route) => {
    const { minutes } = route.request().postDataJSON() as { minutes: number };
    trip = { ...trip, expiresAt: new Date(Date.parse(trip.expiresAt) + minutes * 60_000).toISOString() };
    return answer(route);
  });
  await page.route('**/api/v1/trips/trip-1/end', (route) => {
    trip = { ...trip, status: 'ended' };
    return answer(route);
  });
  return server;
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  // Measured in one go, so a control re-rendering by the clock can't stall the check.
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('a, button')].flatMap((control) => {
      const box = control.getBoundingClientRect();
      const shown = box.width > 0 && box.height > 0 && getComputedStyle(control).visibility !== 'hidden';
      return shown && box.height < 44
        ? [`${control.getAttribute('aria-label') ?? control.textContent}: ${box.height}`]
        : [];
    }),
  );
  expect(small).toEqual([]);
}

test.describe('trip menu', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no accessibility violations in ${colorScheme} mode, nor its dialogs`, async ({ page }) => {
      const server = await asHostWithAMenu(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/trip/trip-1/menu');
      await expect(page.getByRole('heading', { name: 'Saturday at Phoenix' })).toBeVisible();
      await expect.poll(server.connected).toBe(true);
      await expectAccessible(page);

      await page.getByRole('button', { name: 'End trip for everyone' }).click();
      await expect(page.getByRole('dialog', { name: 'End this trip for everyone?' })).toBeVisible();
      await expectAccessible(page);
      await page.getByRole('button', { name: 'Keep sharing' }).click();

      await page.getByRole('button', { name: /Extend sharing time/ }).click();
      await expect(page.getByRole('dialog', { name: 'Extend sharing time' })).toBeVisible();
      await expectAccessible(page);
    });

    test(`warns ten minutes before the end, accessibly, in ${colorScheme} mode`, async ({ page }) => {
      await asHostWithAMenu(page, 8 * 60_000);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/trip/trip-1');
      await expect(page.getByRole('dialog', { name: 'Sharing ends in 8 min' })).toBeVisible();
      await expectAccessible(page);
    });
  }

  test('works with the keyboard and closes with Esc', async ({ page }) => {
    const server = await asHostWithAMenu(page);
    await page.goto('/trip/trip-1');
    await expect.poll(server.connected).toBe(true);

    await page.getByRole('link', { name: 'Trip menu' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/trip\/trip-1\/menu$/);
    await expect(page.getByRole('heading', { name: 'Saturday at Phoenix' })).toBeFocused();

    const end = page.getByRole('button', { name: 'End trip for everyone' });
    await end.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'End this trip for everyone?' })).toBeVisible();
    // Esc closes the dialog first, giving focus back, and leaves the menu open.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(end).toBeFocused();
    await expect(page).toHaveURL(/\/menu$/);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/trip\/trip-1$/);
  });

  test('adds time, then ends the trip for everyone', async ({ page }) => {
    const server = await asHostWithAMenu(page);
    await page.goto('/trip/trip-1/menu');
    await expect.poll(server.connected).toBe(true);

    await page.getByRole('button', { name: /Extend sharing time/ }).click();
    await page.getByRole('radio', { name: '30 minutes' }).click();
    await page.getByRole('button', { name: 'Extend sharing', exact: true }).click();
    await expect(page.getByText(/^Sharing now ends at /)).toBeVisible();
    await expect(page.getByRole('button', { name: /Extend sharing time/ })).toContainText('3 h left');

    await page.getByRole('button', { name: 'End trip for everyone' }).click();
    await page.getByRole('button', { name: 'End trip', exact: true }).click();
    await expect(page).toHaveURL(/\/trip\/trip-1\/ended$/);
    await expect(page.getByRole('heading', { name: 'Trip complete' })).toBeVisible();
  });

  for (const width of [320, 390, 768]) {
    test(`fits ${width} px without sideways scroll`, async ({ page }) => {
      await asHostWithAMenu(page);
      await page.setViewportSize({ width, height: 640 });
      await page.goto('/trip/trip-1/menu');
      await expect(page.getByRole('heading', { name: 'Saturday at Phoenix' })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
      const end = page.getByRole('button', { name: 'End trip for everyone' });
      await end.scrollIntoViewIfNeeded();
      await expect(end).toBeInViewport();
    });
  }
});

/** The host is sharing but has paused, and so has Aman, who paused 4 minutes ago. */
async function asHostPaused(page: Page) {
  const server = await asHostWithAMenu(page);
  const pauses: boolean[] = [];
  let paused = true;
  const pausedAt = new Date().toISOString();
  await page.route('**/api/v1/trips/trip-1/members', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          memberId: 'm-priya',
          displayName: 'Priya',
          color: '#0F6E56',
          role: 'host',
          you: true,
          sharing: true,
          location: null,
          arrivedAt: null,
          travelMode: null,
          pausedAt: paused ? pausedAt : null,
        },
        {
          memberId: 'm-aman',
          displayName: 'Aman',
          color: '#993C1D',
          role: 'member',
          you: false,
          sharing: true,
          location: { lat: 18.56, lng: 73.91, acc: 10, ts: new Date(Date.now() - 4 * 60_000).toISOString() },
          arrivedAt: null,
          travelMode: null,
          pausedAt,
        },
      ]),
    }),
  );
  await page.route('**/api/v1/trips/trip-1/members/me/pause', (route) => {
    paused = (route.request().postDataJSON() as { paused: boolean }).paused;
    pauses.push(paused);
    return route.fulfill({ status: 204 });
  });
  return { server, pauses };
}

test.describe('pause my location', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      const { server } = await asHostPaused(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/trip/trip-1/friend/m-aman');
      await expect(page.getByText(/^Paused · last seen \d+ min ago$/)).toBeVisible();
      await expect(page.getByText('Your location is paused')).toBeVisible();
      await expect.poll(server.connected).toBe(true);
      await expectAccessible(page);

      await page.goto('/trip/trip-1/menu');
      await expect(page.getByRole('switch', { name: 'Pause my location' })).toBeChecked();
      await expectAccessible(page);
    });
  }

  test('works with the keyboard, from the menu and from the map', async ({ page }) => {
    const { server, pauses } = await asHostPaused(page);
    await page.goto('/trip/trip-1/menu');
    await expect.poll(server.connected).toBe(true);

    const toggle = page.getByRole('switch', { name: 'Pause my location' });
    await expect(toggle).toBeChecked();
    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(toggle).not.toBeChecked();

    await page.keyboard.press('Space');
    await expect(toggle).toBeChecked();
    await page.keyboard.press('Escape');
    const resume = page.getByRole('button', { name: 'Resume' });
    await resume.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Your location is paused')).toHaveCount(0);
    expect(pauses).toEqual([false, true, false]);
  });
});

test.describe('trip summaries', () => {
  async function onTripComplete(page: Page) {
    const server = await asHostOnTheLiveMap(page);
    await page.route('**/api/v1/trips/trip-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...signedInTrip, status: 'ended' }),
      }),
    );
    return server;
  }

  /** The host reaches the destination while friends are still on the way. */
  async function arriving(page: Page) {
    const server = await asHostOnTheLiveMap(page);
    await page.goto('/trip/trip-1');
    await expect.poll(server.connected).toBe(true);
    server.send('/topic/trip.trip-1.events', {
      type: 'ARRIVED',
      memberId: 'm-priya',
      displayName: 'Priya',
      at: '',
    });
    await expect(page.getByRole('heading', { name: 'You made it!' })).toBeVisible();
    return server;
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`Trip complete has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      await onTripComplete(page);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/trip/trip-1/ended');
      await expect(page.getByRole('region', { name: 'Trip summary' })).toContainText('8.1 km');
      await expectAccessible(page);
    });

    test(`You made it! has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await arriving(page);
      await expect(page.getByRole('region', { name: 'You made it!' })).toContainText('8.1 km');
      await expectAccessible(page);
    });
  }

  test('Trip complete shows the numbers and leads on', async ({ page }) => {
    await onTripComplete(page);
    await page.goto('/trip/trip-1/ended');

    const pass = page.getByRole('region', { name: 'Trip summary' });
    await expect(pass).toContainText('8.1 km');
    await expect(pass).toContainText('19 min');
    await expect(pass).toContainText('Phoenix Marketcity');
    await page.getByRole('link', { name: 'View trip history' }).click();
    await expect(page).toHaveURL(/\/me\/history$/);
  });

  test('You made it! keeps sharing, with the keyboard', async ({ page }) => {
    await arriving(page);
    await expect(page).toHaveURL(/\/trip\/trip-1\/arrived$/);

    await page.getByRole('button', { name: 'Keep sharing' }).focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/trip\/trip-1$/);
    await expect(page.getByRole('heading', { name: 'You made it!' })).toHaveCount(0);
  });

  for (const width of [320, 390, 768]) {
    test(`both fit ${width} px without sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 760 });
      await arriving(page);
      const overflow = () =>
        page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(await overflow()).toBe(0);

      await onTripComplete(page);
      await page.goto('/trip/trip-1/ended');
      await expect(page.getByRole('region', { name: 'Trip summary' })).toContainText('8.1 km');
      expect(await overflow()).toBe(0);
    });
  }
});

test.describe('privacy and data', () => {
  const pages: Array<[string, string, string]> = [
    ['privacy and data', '/me/privacy', 'Privacy and data'],
    ['delete my account', '/me/delete', 'Delete my account'],
    ['account closed', '/account-closed?removeAt=2026-12-20T10:00:00Z', 'Your account is closed'],
    ['terms and privacy policy', '/privacy', 'Terms and Privacy Policy'],
  ];

  for (const [name, path, heading] of pages) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${name} has no accessibility violations in ${colorScheme} mode`, async ({ page }) => {
        await asHostWithATrip(page);
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(path);
        await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
        await expectAccessible(page);
      });
    }

    for (const width of [320, 390, 768]) {
      test(`${name} fits ${width} px without sideways scroll`, async ({ page }) => {
        await asHostWithATrip(page);
        await page.setViewportSize({ width, height: 760 });
        await page.goto(path);
        await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBe(0);
      });
    }
  }

  test('the sign-up link to the policy works', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('link', { name: 'Terms and Privacy Policy' }).click();
    await expect(page.getByRole('heading', { name: 'Terms and Privacy Policy', level: 1 })).toBeVisible();
  });

  test('downloads my data as a file', async ({ page }) => {
    await asHostWithATrip(page);
    await page.route('**/api/v1/me/export', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ trips: [] }) }),
    );
    await page.goto('/me/privacy');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download my data/ }).click();

    expect((await download).suggestedFilename()).toBe('squadmap-data.json');
    await expect(page.getByText('Your data is saved as squadmap-data.json.')).toBeVisible();
  });

  test('deletes the account with the keyboard, then says when it goes for good', async ({ page }) => {
    await asHostWithATrip(page);
    let deleted = false;
    await page.route('**/api/v1/me', (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback();
      deleted = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ removeAt: '2026-12-20T10:00:00Z' }),
      });
    });
    await page.route('**/api/v1/auth/logout', (route) => route.fulfill({ status: 204 }));
    await page.goto('/me/privacy');

    await page.getByRole('link', { name: 'Delete my account' }).click();
    await page.getByLabel('Your password').fill('correct horse battery');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'Your account is closed' })).toBeVisible();
    await expect(page.getByText(/deleted for good on 20 December 2026/)).toBeVisible();
    expect(deleted).toBe(true);
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
