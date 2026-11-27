import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lastClient } from '../../test/fakeStomp';
import { jsonResponse, renderApp, sampleTrip, testUser } from '../../test/renderApp';
import { useSession } from '../auth/session';
import { behindText } from '../live/liveFormat';
import type { Eta, LiveMember } from '../live/liveTypes';
import { useLiveStore } from '../live/liveStore';
import { DEFAULT_SETTINGS } from '../profile/settingsApi';
import { distanceText, lengthText, type TripSummary } from './summaryApi';

const fetchMock = vi.fn<typeof fetch>();
const EVENTS = '/topic/trip.trip-1.events';
const ETAS = '/topic/trip.trip-1.eta';

const me: LiveMember = {
  memberId: 'm-aman',
  displayName: 'Aman',
  color: '#993C1D',
  role: 'member',
  you: true,
  sharing: true,
  location: null,
  arrivedAt: null,
  travelMode: null,
  pausedAt: null,
};
const priya: LiveMember = { ...me, memberId: 'm-priya', displayName: 'Priya', role: 'host', you: false };
const rohan: LiveMember = { ...me, memberId: 'm-rohan', displayName: 'Rohan', you: false };

const summary = (overrides: Partial<TripSummary> = {}): TripSummary => ({
  id: 'trip-1',
  name: 'Saturday at Phoenix',
  destination: sampleTrip.destination,
  status: 'ended',
  role: 'member',
  startsAt: '2026-11-19T13:10:00Z',
  endedAt: '2026-11-19T13:29:00Z',
  durationSeconds: 1_140,
  friendCount: 4,
  distanceM: 8_100,
  arrivedAt: null,
  ...overrides,
});

type Routes = Record<string, () => Response>;

function serve(routes: Routes) {
  fetchMock.mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input).replace('/api/v1', '')}`;
    const answer = routes[key];
    if (!answer) throw new Error(`Unexpected call: ${key}`);
    return answer();
  });
}

const calls = (key: string) =>
  fetchMock.mock.calls.filter(([input, init]) => `${init?.method ?? 'GET'} ${String(input)}` === key);

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  useSession.setState({ status: 'signedIn', user: testUser, guest: null, accessToken: 't' });
  useLiveStore.setState({ tripId: null, positions: {} });
  sessionStorage.clear();
  // jsdom has no native dialog; give it just enough.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('Trip complete', () => {
  it('shows how the trip went, on a used boarding pass', async () => {
    serve({
      'GET /trips/trip-1/summary': () => jsonResponse(200, summary()),
      'GET /trips/trip-1': () => jsonResponse(200, { ...sampleTrip, status: 'ended', role: 'member' }),
    });
    renderApp('/trip/trip-1/ended');

    expect(await screen.findByRole('heading', { name: 'Trip complete' })).toBeInTheDocument();
    const pass = await screen.findByRole('region', { name: 'Trip summary' });
    await waitFor(() => expect(pass).toHaveTextContent('8.1 km'));
    expect(pass).toHaveTextContent('Distance');
    expect(pass).toHaveTextContent('19 min');
    expect(pass).toHaveTextContent('4Friends');
    expect(pass).toHaveTextContent('Phoenix Marketcity');
    expect(pass).toHaveTextContent('Completed');
    expect(
      screen.getByText('Everyone stopped sharing. Your location is no longer stored.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/home');
    expect(screen.getByRole('link', { name: 'View trip history' })).toHaveAttribute('href', '/me/history');
    expect(screen.getByRole('link', { name: 'Plan another trip' })).toHaveAttribute(
      'href',
      '/trip/new/destination',
    );
    expect(screen.getByRole('link', { name: 'Read the trip chat' })).toHaveAttribute(
      'href',
      '/trip/trip-1/chat',
    );
  });

  it('says "1 Friend" for one friend', async () => {
    serve({
      'GET /trips/trip-1/summary': () => jsonResponse(200, { ...summary(), friendCount: 1 }),
      'GET /trips/trip-1': () => jsonResponse(200, { ...sampleTrip, status: 'ended', role: 'member' }),
    });
    renderApp('/trip/trip-1/ended');

    const pass = await screen.findByRole('region', { name: 'Trip summary' });
    await waitFor(() => expect(pass).toHaveTextContent('1Friend'));
    expect(pass).not.toHaveTextContent('Friends');
  });

  it('shows a dash for someone who never shared, in the chosen unit otherwise', () => {
    expect(distanceText(null, 'km')).toBe('–');
    expect(distanceText(0, 'km')).toBe('0 m');
    expect(distanceText(8_100, 'mi')).toBe('5 mi');
    expect(lengthText(30)).toBe('1 min');
    expect(lengthText(3_900)).toBe('1 h 5 min');
  });

  it('in miles when that is the setting', async () => {
    serve({
      'GET /trips/trip-1/summary': () => jsonResponse(200, summary({ distanceM: 16_093 })),
      'GET /trips/trip-1': () => jsonResponse(200, { ...sampleTrip, status: 'ended' }),
    });
    renderApp('/trip/trip-1/ended', { settings: { ...DEFAULT_SETTINGS, distanceUnit: 'mi' } });

    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Trip summary' })).toHaveTextContent('10 mi'),
    );
  });

  it('lets a guest finish, which forgets them on this device', async () => {
    useSession.setState({
      status: 'guest',
      user: null,
      guest: { memberId: 'm-aman', tripId: 'trip-1', displayName: 'Aman', color: '#993C1D' },
      accessToken: 'g',
    });
    serve({
      'GET /trips/trip-1/summary': () => jsonResponse(200, summary()),
      'GET /trips/trip-1': () => jsonResponse(200, { ...sampleTrip, status: 'ended', role: 'member' }),
      'POST /guest/logout': () => new Response(null, { status: 204 }),
    });
    renderApp('/trip/trip-1/ended');

    await screen.findByRole('heading', { name: 'Trip complete' });
    expect(screen.queryByRole('link', { name: 'View trip history' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Plan another trip' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(useSession.getState().status).toBe('signedOut'));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
  });

  it('offers Retry when the summary can’t be loaded', async () => {
    let answer = () => jsonResponse(500, { code: 'INTERNAL_ERROR' });
    serve({
      'GET /trips/trip-1/summary': () => answer(),
      'GET /trips/trip-1': () => jsonResponse(200, { ...sampleTrip, status: 'ended' }),
    });
    renderApp('/trip/trip-1/ended');

    const retry = await screen.findByRole('button', { name: 'Retry' }, { timeout: 5_000 });
    answer = () => jsonResponse(200, summary());
    await userEvent.click(retry);

    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Trip summary' })).toHaveTextContent('8.1 km'),
    );
  });

  it('says so to someone who finished while friends carry on', async () => {
    serve({
      'GET /trips/trip-1/summary': () => jsonResponse(200, summary({ status: 'active', endedAt: null })),
      'GET /trips/trip-1': () => jsonResponse(404, { code: 'TRIP_NOT_FOUND' }),
    });
    renderApp('/trip/trip-1/ended');

    expect(await screen.findByRole('heading', { name: 'You’ve finished' })).toBeInTheDocument();
    expect(
      screen.getByText('You stopped sharing. Friends on the trip can no longer see you.'),
    ).toBeInTheDocument();
  });
});

describe('You made it!', () => {
  function serveLive(members: LiveMember[], extra: Routes = {}, role: 'host' | 'member' = 'member') {
    serve({
      'GET /trips/trip-1': () =>
        jsonResponse(200, {
          ...sampleTrip,
          role,
          expiresAt: new Date(Date.now() + 3 * 3_600_000).toISOString(),
        }),
      'GET /trips/trip-1/members': () => jsonResponse(200, members),
      'GET /trips/trip-1/eta': () => jsonResponse(200, []),
      'GET /trips/trip-1/messages?limit=50': () =>
        jsonResponse(200, { items: [], nextBefore: null, unread: 0, memberId: 'm-aman' }),
      'GET /trips/trip-1/summary': () =>
        jsonResponse(
          200,
          summary({ status: 'active', endedAt: null, distanceM: 3_400, durationSeconds: 1_500 }),
        ),
      ...extra,
    });
  }

  async function arrive() {
    renderApp('/trip/trip-1');
    await screen.findByText('K7QX2P9T');
    await waitFor(() => expect(lastClient().connected).toBe(true));
    const client = lastClient();
    const eta = (memberId: string, minutes: number): Eta => ({
      memberId,
      distanceM: 1_000,
      durationS: minutes * 60,
      mode: 'car',
      progress: 0.5,
      estimated: false,
      computedAt: new Date().toISOString(),
    });
    act(() => {
      client.deliver(ETAS, eta('m-priya', 1));
      client.deliver(ETAS, eta('m-rohan', 12));
    });
    act(() => client.deliver(EVENTS, { type: 'ARRIVED', memberId: 'm-aman', displayName: 'Aman', at: 'x' }));
    return client;
  }

  it('opens when you reach the destination, with your numbers so far', async () => {
    serveLive([me, priya, rohan]);
    await arrive();

    expect(await screen.findByRole('heading', { name: 'You made it!' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/trip/trip-1/arrived');
    expect(
      screen.getByText(/You reached Phoenix Marketcity\. Everyone else is 1 to 12 min behind\./),
    ).toBeInTheDocument();
    const stats = screen.getByRole('region', { name: 'You made it!' });
    await waitFor(() => expect(stats).toHaveTextContent('3.4 km'));
    expect(stats).toHaveTextContent('25 min');
    expect(stats).toHaveTextContent('2Friends');
  });

  it('keeps sharing and goes back to the map', async () => {
    serveLive([me, priya]);
    await arrive();

    await userEvent.click(await screen.findByRole('button', { name: 'Keep sharing' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/trip\/trip-1$/));
    expect(screen.queryByRole('heading', { name: 'You made it!' })).not.toBeInTheDocument();
    expect(calls('DELETE /api/v1/trips/trip-1/members/me')).toHaveLength(0);
  });

  it('finishing leaves the trip and shows how it went', async () => {
    serveLive([me, priya], {
      'DELETE /trips/trip-1/members/me': () => new Response(null, { status: 204 }),
    });
    await arrive();

    await userEvent.click(await screen.findByRole('button', { name: 'Stop sharing and finish' }));

    await waitFor(() => expect(calls('DELETE /api/v1/trips/trip-1/members/me')).toHaveLength(1));
    expect(await screen.findByRole('heading', { name: 'You’ve finished' })).toBeInTheDocument();
  });

  it('for the host, finishing asks before ending the trip for everyone', async () => {
    const host = { ...me, role: 'host' as const };
    serveLive([host, priya], {}, 'host');
    await arrive();

    await userEvent.click(await screen.findByRole('button', { name: 'Stop sharing and finish' }));

    expect(await screen.findByRole('dialog', { name: 'End this trip for everyone?' })).toBeInTheDocument();
    expect(calls('DELETE /api/v1/trips/trip-1/members/me')).toHaveLength(0);
  });

  it('shows once per trip; a second arrival is just a toast', async () => {
    serveLive([me, priya]);
    sessionStorage.setItem('squadmap.arrivedShown', 'trip-1');
    await arrive();

    expect(await screen.findByText('You arrived at Phoenix Marketcity')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'You made it!' })).not.toBeInTheDocument();
  });

  it('words who is still on the way', () => {
    expect(behindText([], 0)).toBe('');
    expect(behindText([], 2)).toBe(' Everyone else is here or not sharing.');
    expect(behindText([4], 1)).toBe(' Your friend is 4 min behind.');
    expect(behindText([4], 3)).toBe(' One friend is still 4 min behind.');
    expect(behindText([3, 3], 2)).toBe(' Everyone else is 3 min behind.');
    expect(behindText([0, 12], 2)).toBe(' Everyone else is 1 to 12 min behind.');
  });
});
