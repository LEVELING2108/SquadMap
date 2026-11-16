import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderApp, sampleTrip, testUser } from '../../test/renderApp';
import { useSession } from '../auth/session';
import { alertLink, alertTitle, isToday, type Alert } from './alertsApi';

const fetchMock = vi.fn<typeof fetch>();
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function alert(overrides: Partial<Alert>): Alert {
  return {
    id: 'a1',
    kind: 'member_joined',
    tripId: 'trip-1',
    tripName: 'Saturday at Phoenix',
    actorName: 'Aman',
    actorColor: '#993C1D',
    createdAt: minutesAgo(2),
    read: false,
    tripLive: true,
    ...overrides,
  };
}

let stored: Alert[];

/** A stand-in server whose read marks really change the alerts. */
function serve() {
  fetchMock.mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input).replace('/api/v1', '').split('?')[0]}`;
    const unread = stored.filter((a) => !a.read).length;
    if (key === 'GET /me/alerts') return jsonResponse(200, { items: stored, nextBefore: null, unread });
    if (key === 'GET /me/alerts/unread-count') return jsonResponse(200, { unread });
    if (key === 'POST /me/alerts/read-all') {
      stored = stored.map((a) => ({ ...a, read: true }));
      return new Response(null, { status: 204 });
    }
    const one = /^POST \/me\/alerts\/(.+)\/read$/.exec(key);
    if (one) {
      stored = stored.map((a) => (a.id === one[1] ? { ...a, read: true } : a));
      return new Response(null, { status: 204 });
    }
    if (key === 'GET /trips/trip-1') return jsonResponse(200, sampleTrip);
    if (key.startsWith('GET /me/trips')) return jsonResponse(200, { items: [], nextBefore: null });
    throw new Error(`Unexpected call: ${key}`);
  });
}

beforeEach(() => {
  useSession.setState({ status: 'signedIn', user: testUser, guest: null, accessToken: 't' });
  vi.stubGlobal('fetch', fetchMock);
  stored = [
    alert({ id: 'a1', kind: 'member_joined', actorName: 'Aman', createdAt: minutesAgo(2) }),
    alert({
      id: 'a2',
      kind: 'ending_soon',
      actorName: null,
      actorColor: null,
      createdAt: minutesAgo(5),
      read: true,
    }),
    alert({
      id: 'a3',
      kind: 'trip_ended',
      tripName: 'Lonavala trip',
      actorName: null,
      actorColor: null,
      createdAt: '2026-10-12T10:00:00Z',
      tripLive: false,
      read: true,
    }),
  ];
  serve();
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('Alerts', () => {
  it('groups alerts into today and earlier, in the app’s words', async () => {
    renderApp('/me/alerts', { unreadAlerts: null });

    const today = await screen.findByRole('region', { name: 'Today' });
    const rows = within(today).getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Aman joined your trip');
    expect(rows[0]).toHaveTextContent('Saturday at Phoenix · 2 minutes ago');
    expect(rows[0]).toHaveTextContent('Unread');
    expect(rows[1]).toHaveTextContent('Sharing ends soon');
    expect(rows[1]).toHaveTextContent('Extend or end the trip');
    expect(rows[1]).not.toHaveTextContent('Unread');
    const earlier = screen.getByRole('region', { name: 'Earlier' });
    expect(within(earlier).getByRole('button')).toHaveTextContent('Lonavala trip ended');
  });

  it('opening an alert marks it read and goes to the trip', async () => {
    const user = userEvent.setup();
    renderApp('/me/alerts', { unreadAlerts: null });

    await user.click(await screen.findByRole('button', { name: /Aman joined your trip/ }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/trip/trip-1/invite'));
    expect(stored.find((a) => a.id === 'a1')!.read).toBe(true);
  });

  it('marks everything read at once, and the button goes away', async () => {
    const user = userEvent.setup();
    renderApp('/me/alerts', { unreadAlerts: null });

    await user.click(await screen.findByRole('button', { name: 'Mark all read' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeInTheDocument(),
    );
    expect(stored.every((a) => a.read)).toBe(true);
    expect(screen.queryByText('Unread')).not.toBeInTheDocument();
  });

  it('shows the unread count on the Alerts tab', async () => {
    renderApp('/me/alerts', { unreadAlerts: null });

    const tabs = screen.getByRole('navigation', { name: 'Main' });
    expect(await within(tabs).findByRole('link', { name: 'Alerts, 1 unread' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('explains an empty inbox', async () => {
    stored = [];
    renderApp('/me/alerts', { unreadAlerts: null });

    expect(await screen.findByRole('heading', { name: 'No alerts yet' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeInTheDocument();
  });

  it('puts the unread count on the profile’s Alerts row', () => {
    renderApp('/me', { unreadAlerts: 12 });

    const account = screen.getByRole('navigation', { name: 'Your account' });
    expect(within(account).getByRole('link', { name: 'Alerts, 12 unread' })).toHaveTextContent('9+');
    // The bottom tab shows the same count.
    const tabs = screen.getByRole('navigation', { name: 'Main' });
    expect(within(tabs).getByRole('link', { name: 'Alerts, 12 unread' })).toBeInTheDocument();
  });
});

describe('alert helpers', () => {
  it('words every kind', () => {
    expect(alertTitle(alert({ kind: 'member_joined' }))).toBe('Aman joined your trip');
    expect(alertTitle(alert({ kind: 'member_left' }))).toBe('Aman left your trip');
    expect(alertTitle(alert({ kind: 'ending_soon' }))).toBe('Sharing ends soon');
    expect(alertTitle(alert({ kind: 'trip_ended', tripName: 'Lonavala trip' }))).toBe('Lonavala trip ended');
  });

  it('leads to the running trip, or to history once it is over', () => {
    expect(alertLink(alert({ kind: 'member_joined', tripLive: true }))).toBe('/trip/trip-1/invite');
    expect(alertLink(alert({ kind: 'ending_soon', tripLive: false }))).toBe('/me/history');
    expect(alertLink(alert({ kind: 'trip_ended', tripLive: false }))).toBe('/me/history');
  });

  it('knows today from yesterday', () => {
    const now = new Date(2026, 10, 17, 9);
    expect(isToday(new Date(2026, 10, 17, 0, 5).toISOString(), now)).toBe(true);
    expect(isToday(new Date(2026, 10, 16, 23, 55).toISOString(), now)).toBe(false);
  });
});
