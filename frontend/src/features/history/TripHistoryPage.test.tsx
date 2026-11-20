import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { staticMapUrl } from '../../lib/map/geo';
import { formatClock } from '../../lib/time';
import { jsonResponse, renderApp, testUser } from '../../test/renderApp';
import { useSession } from '../auth/session';
import { DEFAULT_SETTINGS } from '../profile/settingsApi';
import { friendsLabel, isThisMonth, topFriend, whenLabel, type HistoryTrip } from './historyApi';

const fetchMock = vi.fn<typeof fetch>();

function trip(overrides: Partial<HistoryTrip>): HistoryTrip {
  return {
    id: 'trip-1',
    name: 'Saturday at Phoenix',
    destination: { name: 'Phoenix Marketcity', lat: 18.5622, lng: 73.9167 },
    startsAt: new Date().toISOString(),
    expiresAt: '2026-11-17T16:00:00Z',
    endedAt: new Date().toISOString(),
    status: 'ended',
    role: 'host',
    friendCount: 3,
    friends: ['Aman', 'Sourav', 'Rohan'],
    distanceM: null,
    ...overrides,
  };
}

/** Answers GET /me/trips page by page; other calls fail loudly. */
function serveHistory(...pages: Array<{ items: HistoryTrip[]; nextBefore: string | null }>) {
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/v1/me/settings') return jsonResponse(200, DEFAULT_SETTINGS);
    if (!url.startsWith('/api/v1/me/trips')) throw new Error(`Unexpected call: ${url}`);
    const before = new URL(url, 'http://x').searchParams.get('before');
    const index = before === null ? 0 : pages.findIndex((page) => page.nextBefore === before) + 1;
    return jsonResponse(200, pages[index]);
  });
}

beforeEach(() => {
  useSession.setState({ status: 'signedIn', user: testUser, guest: null, accessToken: 't' });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('Trip history', () => {
  it('lists trips with when they were, who came, and whether they are over', async () => {
    serveHistory({
      items: [
        trip({
          id: 'a',
          name: 'Running now',
          status: 'active',
          endedAt: null,
          friendCount: 1,
          friends: ['Aman'],
        }),
        trip({ id: 'b', name: 'Saturday at Phoenix', distanceM: 8_100 }),
        trip({ id: 'c', name: 'Solo walk', destination: null, friendCount: 0, friends: [] }),
      ],
      nextBefore: null,
    });
    renderApp('/me/history');

    const cards = within(await screen.findByRole('list', { name: 'Trips' })).getAllByRole('listitem');
    expect(cards.map((card) => card.textContent)).toEqual([
      `Running nowLive until ${formatClock('2026-11-17T16:00:00Z', '12h')} · With AmanLive`,
      'Saturday at PhoenixToday · 8.1 km · 3 friendsDone',
      'Solo walkToday · Just youDone',
    ]);
  });

  it('shows when a running trip ends in the chosen time format', async () => {
    serveHistory({
      items: [
        trip({ name: 'Running now', status: 'active', endedAt: null, expiresAt: '2026-11-17T16:00:00Z' }),
      ],
      nextBefore: null,
    });
    renderApp('/me/history', { settings: { ...DEFAULT_SETTINGS, timeFormat: '24h' } });

    const card = within(await screen.findByRole('list', { name: 'Trips' })).getByRole('listitem');
    expect(card).toHaveTextContent(`Live until ${formatClock('2026-11-17T16:00:00Z', '24h')}`);
    expect(formatClock('2026-11-17T16:00:00Z', '24h')).not.toMatch(/AM|PM/);
  });

  it('opens a running trip (the invite for its host, the trip for a member) and a finished one’s summary', async () => {
    serveHistory({
      items: [
        trip({ id: 'a', name: 'Mine', status: 'active', endedAt: null, role: 'host' }),
        trip({ id: 'b', name: 'Joined', status: 'active', endedAt: null, role: 'member' }),
        trip({ id: 'c', name: 'Over' }),
      ],
      nextBefore: null,
    });
    renderApp('/me/history');

    expect(await screen.findByRole('link', { name: /Mine/ })).toHaveAttribute('href', '/trip/a/invite');
    expect(screen.getByRole('link', { name: /Joined/ })).toHaveAttribute('href', '/trip/b');
    expect(screen.getByRole('link', { name: /Over/ })).toHaveAttribute('href', '/trip/c/ended');
  });

  it('filters to this month and to the friend you travel with most', async () => {
    const user = userEvent.setup();
    const lastYear = new Date(new Date().getFullYear() - 1, 5, 12, 10).toISOString();
    serveHistory({
      items: [
        trip({ id: 'a', name: 'With both', friends: ['Aman', 'Priya'], friendCount: 2 }),
        trip({ id: 'b', name: 'Old with Aman', startsAt: lastYear, friends: ['Aman'], friendCount: 1 }),
        trip({ id: 'c', name: 'Alone', friends: [], friendCount: 0 }),
      ],
      nextBefore: null,
    });
    renderApp('/me/history');
    const names = () =>
      within(screen.getByRole('list', { name: 'Trips' }))
        .getAllByRole('heading')
        .map((heading) => heading.textContent);
    await screen.findByRole('list', { name: 'Trips' });
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'This month' }));
    expect(names()).toEqual(['With both', 'Alone']);

    await user.click(screen.getByRole('button', { name: 'With Aman' }));
    expect(names()).toEqual(['With both', 'Old with Aman']);
    expect(screen.getByRole('button', { name: 'With Aman' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(names()).toHaveLength(3);
  });

  it('says when a filter leaves nothing', async () => {
    const user = userEvent.setup();
    const lastYear = new Date(new Date().getFullYear() - 1, 5, 12, 10).toISOString();
    serveHistory({ items: [trip({ startsAt: lastYear })], nextBefore: null });
    renderApp('/me/history');
    await screen.findByRole('list', { name: 'Trips' });

    await user.click(screen.getByRole('button', { name: 'This month' }));

    expect(screen.getByText('No trips match this filter.')).toBeInTheDocument();
  });

  it('loads older trips on request', async () => {
    const user = userEvent.setup();
    serveHistory(
      { items: [trip({ id: 'b', name: 'Newer' })], nextBefore: 'b' },
      { items: [trip({ id: 'a', name: 'Older' })], nextBefore: null },
    );
    renderApp('/me/history');

    await user.click(await screen.findByRole('button', { name: 'Show older trips' }));

    expect(await screen.findByRole('heading', { name: 'Older' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Newer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show older trips' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain(
      '/api/v1/me/trips?limit=20&before=b',
    );
  });

  it('invites someone new to start a trip', async () => {
    serveHistory({ items: [], nextBefore: null });
    renderApp('/me/history');

    expect(await screen.findByRole('heading', { name: 'No trips yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New trip' })).toHaveAttribute('href', '/trip/new/destination');
    expect(screen.queryByRole('group', { name: 'Filter trips' })).not.toBeInTheDocument();
  });

  it('shows the main navigation with Trips as the current page', async () => {
    serveHistory({ items: [], nextBefore: null });
    renderApp('/me/history');

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Trips' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Explore' })).toHaveAttribute('href', '/home');
  });

  it('explains a failure to load', async () => {
    // A 4xx is shown at once; server errors are retried first.
    fetchMock.mockResolvedValue(
      jsonResponse(429, { code: 'RATE_LIMITED', detail: 'Slow down.', retryAfter: 30 }),
    );
    renderApp('/me/history');

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Try again in 30 seconds.');
  });
});

describe('history helpers', () => {
  const now = new Date(2026, 10, 16, 15);

  it.each([
    [new Date(2026, 10, 16, 1), 'Today'],
    [new Date(2026, 10, 15, 23), 'Yesterday'],
    [new Date(2026, 9, 12, 12), 'Oct 12'],
    [new Date(2025, 9, 12, 12), 'Oct 12, 2025'],
  ])('%s reads %j', (date, words) => {
    expect(whenLabel(date.toISOString(), now)).toBe(words);
  });

  it('describes who came', () => {
    expect(friendsLabel({ friendCount: 0, friends: [] })).toBe('Just you');
    expect(friendsLabel({ friendCount: 1, friends: ['Aman'] })).toBe('With Aman');
    expect(friendsLabel({ friendCount: 7, friends: ['Aman', 'Priya'] })).toBe('7 friends');
  });

  it('picks the most frequent friend, and nobody for one-off company', () => {
    expect(topFriend([trip({ friends: ['Aman'] }), trip({ friends: ['Priya'] })])).toBeNull();
    expect(
      topFriend([
        trip({ friends: ['Aman', 'Priya'] }),
        trip({ friends: ['Priya'] }),
        trip({ friends: ['Aman', 'Priya'] }),
      ]),
    ).toBe('Priya');
  });

  it('knows this month from last year’s same month', () => {
    expect(isThisMonth(new Date(2026, 10, 1).toISOString(), now)).toBe(true);
    expect(isThisMonth(new Date(2025, 10, 16).toISOString(), now)).toBe(false);
  });

  it('builds a still map address with longitude first and the token encoded', () => {
    expect(staticMapUrl({ lat: 18.56221234, lng: 73.9167 }, 'mapbox/dark-v11', 'pk.a b')).toBe(
      'https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/73.91670,18.56221,13.5,0/600x200@2x?access_token=pk.a%20b',
    );
  });
});
