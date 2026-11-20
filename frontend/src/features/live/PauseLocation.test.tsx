import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lastClient } from '../../test/fakeStomp';
import { jsonResponse, renderApp, sampleTrip, testUser } from '../../test/renderApp';
import { useSession } from '../auth/session';
import type { LiveMember } from './liveTypes';
import { useLiveStore } from './liveStore';

const fetchMock = vi.fn<typeof fetch>();
const EVENTS = '/topic/trip.trip-1.events';

const priya: LiveMember = {
  memberId: 'm-priya',
  displayName: 'Priya',
  color: '#0F6E56',
  role: 'host',
  you: true,
  sharing: true,
  location: null,
  arrivedAt: null,
  travelMode: null,
  pausedAt: null,
};
const aman: LiveMember = {
  ...priya,
  memberId: 'm-aman',
  displayName: 'Aman',
  role: 'member',
  you: false,
  location: { lat: 18.56, lng: 73.91, acc: 10, ts: new Date(Date.now() - 4 * 60_000).toISOString() },
};

type Answer = (init: RequestInit | undefined) => Response | Promise<Response>;

/** Serves the trip; `members` is read on every call, so a test can change who is paused. */
function serve(members: () => LiveMember[], routes: Record<string, Answer> = {}) {
  const all: Record<string, Answer> = {
    'GET /trips/trip-1': () =>
      jsonResponse(200, { ...sampleTrip, expiresAt: new Date(Date.now() + 3 * 3_600_000).toISOString() }),
    'GET /trips/trip-1/members': () => jsonResponse(200, members()),
    'GET /trips/trip-1/eta': () => jsonResponse(200, []),
    'GET /trips/trip-1/messages?limit=50': () =>
      jsonResponse(200, { items: [], nextBefore: null, unread: 0, memberId: 'm-priya' }),
    ...routes,
  };
  fetchMock.mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input).replace('/api/v1', '')}`;
    const answer = all[key];
    if (!answer) throw new Error(`Unexpected call: ${key}`);
    return answer(init);
  });
}

const pauses = () =>
  fetchMock.mock.calls
    .filter(([input, init]) => init?.method === 'PUT' && String(input).endsWith('/members/me/pause'))
    .map(([, init]) => JSON.parse(String(init?.body)) as { paused: boolean });

const watchPosition = vi.fn(() => 7);

async function open(path: string) {
  renderApp(path);
  await waitFor(() => expect(lastClient().connected).toBe(true));
  return lastClient();
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  useSession.setState({ status: 'signedIn', user: testUser, guest: null, accessToken: 't' });
  useLiveStore.setState({ tripId: null, positions: {} });
  sessionStorage.clear();
  watchPosition.mockClear();
  Object.defineProperty(navigator, 'geolocation', {
    value: { watchPosition, clearWatch: vi.fn(), getCurrentPosition: vi.fn() },
    configurable: true,
  });
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'geolocation');
});

describe('Pause my location', () => {
  it('pauses from the trip menu, stops reading the location, and resumes from the map', async () => {
    const user = userEvent.setup();
    let me = priya;
    serve(() => [me, aman], {
      'PUT /trips/trip-1/members/me/pause': (init) => {
        const { paused } = JSON.parse(String(init?.body)) as { paused: boolean };
        me = { ...priya, pausedAt: paused ? new Date().toISOString() : null };
        return new Response(null, { status: 204 });
      },
    });
    await open('/trip/trip-1/menu');
    await waitFor(() => expect(watchPosition).toHaveBeenCalled());

    const toggle = await screen.findByRole('switch', { name: 'Pause my location' });
    expect(toggle).toHaveAccessibleDescription('Friends see your last known spot');
    expect(toggle).not.toBeChecked();
    await user.click(toggle);

    await waitFor(() => expect(screen.getByRole('switch', { name: 'Pause my location' })).toBeChecked());
    expect(pauses()).toEqual([{ paused: true }]);
    expect(navigator.geolocation.clearWatch).toHaveBeenCalled();

    await user.click(screen.getByRole('link', { name: 'Close the menu' }));
    expect(await screen.findByText('Your location is paused')).toBeInTheDocument();
    watchPosition.mockClear();
    await user.click(screen.getByRole('button', { name: 'Resume' }));

    await waitFor(() => expect(screen.queryByText('Your location is paused')).not.toBeInTheDocument());
    expect(pauses()).toEqual([{ paused: true }, { paused: false }]);
    await waitFor(() => expect(watchPosition).toHaveBeenCalled());
  });

  it('has no switch for someone not sharing', async () => {
    serve(() => [{ ...priya, sharing: false }, aman]);
    await open('/trip/trip-1/menu');

    await screen.findByRole('region', { name: 'Saturday at Phoenix' });
    expect(screen.queryByRole('switch', { name: 'Pause my location' })).not.toBeInTheDocument();
  });

  it('starts paused after a reload, without reading the location', async () => {
    serve(() => [{ ...priya, pausedAt: new Date().toISOString() }, aman]);
    await open('/trip/trip-1');

    expect(await screen.findByText('Your location is paused')).toBeInTheDocument();
    expect(watchPosition).not.toHaveBeenCalled();
  });

  it('shows a paused friend as paused, with when they were last seen', async () => {
    serve(() => [priya, { ...aman, pausedAt: new Date().toISOString() }]);
    await open('/trip/trip-1/friend/m-aman');

    expect(await screen.findByText('Paused · last seen 4 min ago')).toBeInTheDocument();
  });

  it('says on the map’s sheet who has paused', async () => {
    serve(() => [priya, { ...aman, pausedAt: new Date().toISOString() }]);
    await open('/trip/trip-1');

    expect(await screen.findByText('Aman paused their location')).toBeInTheDocument();
  });

  it('says Paused in who’s on the way', async () => {
    serve(() => [priya, { ...aman, pausedAt: new Date().toISOString() }]);
    await open('/trip/trip-1/eta');

    const list = await screen.findByRole('list', { name: 'Everyone on this trip' });
    expect(await within(list).findByText('Paused')).toBeInTheDocument();
  });

  it('tells everyone when a friend pauses and resumes', async () => {
    serve(() => [priya, aman]);
    const client = await open('/trip/trip-1');
    await screen.findByRole('link', { name: 'Trip menu' });

    act(() => client.deliver(EVENTS, { type: 'PAUSED', memberId: 'm-aman', displayName: 'Aman', at: '' }));
    expect(await screen.findByText('Aman paused their location')).toBeInTheDocument();

    act(() => client.deliver(EVENTS, { type: 'RESUMED', memberId: 'm-aman', displayName: 'Aman', at: '' }));
    expect(await screen.findByText('Aman is sharing again')).toBeInTheDocument();
  });
});
