import { onlineManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeClient, lastClient } from '../../test/fakeStomp';
import { jsonResponse, renderApp, sampleTrip, testUser } from '../../test/renderApp';
import { useSession } from '../auth/session';
import type { Eta, LiveMember } from './liveTypes';
import { useLiveStore } from './liveStore';

const fetchMock = vi.fn<typeof fetch>();
const LOCATIONS = '/topic/trip.trip-1.locations';
const EVENTS = '/topic/trip.trip-1.events';
const ETAS = '/topic/trip.trip-1.eta';
const ERRORS = '/user/queue/errors';

const priya: LiveMember = {
  memberId: 'm-priya',
  displayName: 'Priya',
  color: '#0F6E56',
  role: 'host',
  you: true,
  sharing: true,
  location: null,
  arrivedAt: null,
};
const aman: LiveMember = {
  memberId: 'm-aman',
  displayName: 'Aman',
  color: '#993C1D',
  role: 'member',
  you: false,
  sharing: true,
  location: { lat: 18.56, lng: 73.91, acc: 10, ts: new Date().toISOString() },
  arrivedAt: null,
};
const rohan: LiveMember = {
  ...aman,
  memberId: 'm-rohan',
  displayName: 'Rohan',
  sharing: false,
  location: null,
};

type Routes = Record<string, () => Response>;

function serve(members: LiveMember[], extra: Routes = {}) {
  const routes: Routes = {
    'GET /trips/trip-1': () =>
      jsonResponse(200, { ...sampleTrip, expiresAt: new Date(Date.now() + 3 * 3_600_000).toISOString() }),
    'GET /trips/trip-1/members': () => jsonResponse(200, members),
    'GET /trips/trip-1/eta': () => jsonResponse(200, []),
    ...extra,
  };
  fetchMock.mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input).replace('/api/v1', '')}`;
    const answer = routes[key];
    if (!answer) throw new Error(`Unexpected call: ${key}`);
    return answer();
  });
}

const calls = (key: string) =>
  fetchMock.mock.calls.filter(([input, init]) => `${init?.method ?? 'GET'} ${String(input)}` === key);

/** A phone whose location the test moves by hand. */
function withLocation() {
  let onReading: PositionCallback | null = null;
  let onFailure: PositionErrorCallback | null = null;
  const watchPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) => {
    onReading = ok;
    onFailure = fail;
    return 7;
  });
  Object.defineProperty(navigator, 'geolocation', {
    value: { watchPosition, clearWatch: vi.fn(), getCurrentPosition: vi.fn() },
    configurable: true,
  });
  return {
    watchPosition,
    moveTo(lat: number, lng: number, accuracy = 8) {
      act(() =>
        onReading?.({
          coords: { latitude: lat, longitude: lng, accuracy, speed: null, heading: null },
          timestamp: Date.now(),
        } as GeolocationPosition),
      );
    },
    deny() {
      act(() => onFailure?.({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError));
    },
  };
}

async function openLiveMap() {
  renderApp('/trip/trip-1');
  await screen.findByText('K7QX2P9T');
  await waitFor(() => expect(lastClient().connected).toBe(true));
  return lastClient();
}

const friendsList = () => screen.getByRole('list', { name: 'Friends on this trip' });

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  useSession.setState({ status: 'signedIn', user: testUser, guest: null, accessToken: 't' });
  useLiveStore.setState({ tripId: null, positions: {} });
});

afterEach(() => {
  // An "offline" event also pauses TanStack Query, for every later test too.
  onlineManager.setOnline(true);
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'geolocation');
});

describe('Live map', () => {
  it('shows the trip code, how long it has left, and who is on the way', async () => {
    withLocation();
    serve([priya, aman, rohan]);
    await openLiveMap();

    expect(await screen.findByText(/Live · 3 h left/)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '2 friends on the way' })).toBeInTheDocument();
    expect(screen.getByText('Rohan hasn’t shared yet')).toBeInTheDocument();
    expect(within(friendsList()).getByText('Aman, live on the map')).toBeInTheDocument();
    expect(within(friendsList()).getByText('Rohan, not sharing their location yet')).toBeInTheDocument();
  });

  it('subscribes to the trip, its events and its own error queue', async () => {
    withLocation();
    serve([priya]);
    const client = await openLiveMap();

    expect([...client.listeners.keys()]).toEqual([LOCATIONS, EVENTS, ETAS, ERRORS]);
    expect(client.connectHeaders).toEqual({ Authorization: 'Bearer t' });
  });

  it('moves a friend when their location arrives', async () => {
    withLocation();
    serve([priya, { ...aman, location: null }]);
    const client = await openLiveMap();
    await within(friendsList()).findByText('Aman, waiting for their location');

    act(() =>
      client.deliver(LOCATIONS, {
        memberId: 'm-aman',
        lat: 18.57,
        lng: 73.92,
        acc: 9,
        ts: new Date().toISOString(),
      }),
    );

    expect(within(friendsList()).getByText('Aman, live on the map')).toBeInTheDocument();
    expect(useLiveStore.getState().positions['m-aman']?.lat).toBe(18.57);
  });

  it('marks a friend who stopped updating', async () => {
    withLocation();
    const old = new Date(Date.now() - 3 * 60_000).toISOString();
    serve([priya, { ...aman, location: { ...aman.location!, ts: old } }]);
    await openLiveMap();

    expect(await within(friendsList()).findByText('Aman, last seen 3 min ago')).toBeInTheDocument();
  });

  it('sends this phone’s location, at most once per 2 seconds', async () => {
    const phone = withLocation();
    serve([priya]);
    const client = await openLiveMap();
    await waitFor(() => expect(phone.watchPosition).toHaveBeenCalled());

    phone.moveTo(18.5679, 73.9143);
    phone.moveTo(18.569, 73.9143);

    expect(client.published).toHaveLength(1);
    expect(client.published[0]!.destination).toBe('/app/trip.trip-1.loc');
    expect(JSON.parse(client.published[0]!.body)).toMatchObject({ lat: 18.5679, lng: 73.9143, acc: 8 });
  });

  it('does not send readings too rough to show', async () => {
    const phone = withLocation();
    serve([priya]);
    const client = await openLiveMap();
    await waitFor(() => expect(phone.watchPosition).toHaveBeenCalled());

    phone.moveTo(18.5679, 73.9143, 900);

    expect(client.published).toHaveLength(0);
  });

  it('keeps the newest reading while offline and sends it on reconnecting, then reloads everyone', async () => {
    const phone = withLocation();
    serve([priya]);
    const client = await openLiveMap();
    await waitFor(() => expect(phone.watchPosition).toHaveBeenCalled());
    act(() => client.drop());

    phone.moveTo(18.5679, 73.9143);
    expect(client.published).toHaveLength(0);
    const loads = calls('GET /api/v1/trips/trip-1/members').length;
    await act(() => client.connect());

    expect(client.published).toHaveLength(1);
    await waitFor(() => expect(calls('GET /api/v1/trips/trip-1/members').length).toBe(loads + 1));
  });

  it('shows the offline banner when the connection stays down, and Retry reconnects', async () => {
    withLocation();
    serve([priya, aman]);
    const client = await openLiveMap();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    act(() => client.drop());
    expect(screen.queryByText('No connection, showing last known spots')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3_100));

    expect(screen.getByText('No connection, showing last known spots')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
    vi.useRealTimers();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(client.connected).toBe(true));
    expect(screen.queryByText('No connection, showing last known spots')).not.toBeInTheDocument();
  });

  it('drops the connection as soon as the phone says it is offline', async () => {
    withLocation();
    serve([priya]);
    const client = await openLiveMap();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(client.connected).toBe(false);
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });

  it('announces who joined and reloads the list', async () => {
    withLocation();
    serve([priya]);
    const client = await openLiveMap();
    serve([priya, aman]);

    act(() =>
      client.deliver(EVENTS, { type: 'MEMBER_JOINED', memberId: 'm-aman', displayName: 'Aman', at: 'x' }),
    );

    expect(screen.getByText('Aman joined the trip')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '1 friend on the way' })).toBeInTheDocument();
  });

  it('removes someone’s spot as soon as they leave', async () => {
    withLocation();
    serve([priya, aman]);
    const client = await openLiveMap();
    await waitFor(() => expect(useLiveStore.getState().positions['m-aman']).toBeDefined());
    serve([priya]);

    act(() =>
      client.deliver(EVENTS, { type: 'MEMBER_LEFT', memberId: 'm-aman', displayName: 'Aman', at: 'x' }),
    );

    expect(useLiveStore.getState().positions['m-aman']).toBeUndefined();
    expect(screen.getByText('Aman left the trip')).toBeInTheDocument();
  });

  it('stops everything when the trip ends', async () => {
    withLocation();
    serve([priya, aman]);
    const client = await openLiveMap();

    act(() => client.deliver(EVENTS, { type: 'TRIP_ENDED', at: 'x' }));

    expect(await screen.findByRole('heading', { name: 'This trip has ended' })).toBeInTheDocument();
    const ended = screen.getByRole('region', { name: 'This trip has ended' });
    expect(within(ended).getByRole('link', { name: 'Back to home' })).toBeInTheDocument();
    expect(useLiveStore.getState().positions).toEqual({});
    expect(client.active).toBe(false);
  });

  it('shows the trip as ended when the server refuses it as over', async () => {
    withLocation();
    serve([priya]);
    const client = await openLiveMap();

    act(() => client.refuse('TRIP_EXPIRED'));

    expect(await screen.findByRole('heading', { name: 'This trip has ended' })).toBeInTheDocument();
  });

  it('signs in again before reconnecting when the token ran out', async () => {
    withLocation();
    serve([priya], {
      'POST /auth/refresh': () => jsonResponse(200, { user: testUser, accessToken: 'fresh', expiresIn: 900 }),
    });
    const client = await openLiveMap();

    act(() => client.refuse('UNAUTHENTICATED'));
    await act(() => client.connect());

    expect(calls('POST /api/v1/auth/refresh')).toHaveLength(1);
    expect(client.connectHeaders).toEqual({ Authorization: 'Bearer fresh' });
  });
});

describe('Live map, ETAs and arrivals', () => {
  const etaFor = (memberId: string, minutes: number, metres: number): Eta => ({
    memberId,
    distanceM: metres,
    durationS: minutes * 60,
    mode: 'driving',
    progress: 0.2,
    estimated: false,
    computedAt: new Date().toISOString(),
  });
  const sara: LiveMember = { ...aman, memberId: 'm-sara', displayName: 'Sara', color: '#534AB7' };

  it('says who arrives next, and keeps it up to date', async () => {
    withLocation();
    serve([priya, aman, sara], {
      'GET /trips/trip-1/eta': () => jsonResponse(200, [etaFor('m-aman', 4, 1600)]),
    });
    const client = await openLiveMap();

    expect(await screen.findByText('Next: Aman in 4 min')).toBeInTheDocument();
    expect(within(friendsList()).getByText('Aman, live on the map, 4 min away')).toBeInTheDocument();

    act(() => client.deliver(ETAS, etaFor('m-sara', 2, 700)));

    expect(screen.getByText('Next: Sara in 2 min')).toBeInTheDocument();
  });

  it('announces an arrival and marks it', async () => {
    withLocation();
    serve([priya, aman]);
    const client = await openLiveMap();
    serve([priya, { ...aman, arrivedAt: new Date().toISOString() }]);

    act(() => client.deliver(EVENTS, { type: 'ARRIVED', memberId: 'm-aman', displayName: 'Aman', at: 'x' }));

    expect(screen.getByText('Aman arrived at Phoenix Marketcity')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Everyone has arrived' })).toBeInTheDocument();
    expect(screen.getByText('All at Phoenix Marketcity')).toBeInTheDocument();
    expect(within(friendsList()).getByText('Aman, arrived')).toBeInTheDocument();
  });

  it('lists who’s on the way, soonest first and arrivals last, on the same connection', async () => {
    const user = userEvent.setup();
    withLocation();
    serve([priya, aman, sara, { ...rohan, sharing: true, arrivedAt: new Date().toISOString() }], {
      'GET /trips/trip-1/eta': () =>
        jsonResponse(200, [
          etaFor('m-aman', 14, 6200),
          etaFor('m-sara', 4, 1600),
          etaFor('m-priya', 19, 8100),
        ]),
    });
    await openLiveMap();

    await user.click(await screen.findByRole('link', { name: 'Who’s on the way' }));

    expect(await screen.findByRole('heading', { name: 'Who’s on the way' })).toBeInTheDocument();
    expect(screen.getByText('To Phoenix Marketcity')).toBeInTheDocument();
    const rows = within(screen.getByRole('list', { name: 'Everyone on this trip' })).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'SSara1.6 km · drivingArrives in 4 min',
      'AAman6.2 km · drivingArrives in 14 min',
      'PYou8.1 km · drivingArrives in 19 min',
      'RRohanAt destinationArrived',
    ]);
    expect(screen.getByRole('link', { name: 'Invite more friends' })).toHaveAttribute(
      'href',
      '/trip/trip-1/invite',
    );
    // The map and its live connection carried on.
    expect(FakeClient.instances).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Sort by name' }));
    expect(
      within(screen.getByRole('list', { name: 'Everyone on this trip' }))
        .getAllByRole('listitem')
        .map((row) => row.textContent?.charAt(1)),
    ).toEqual(['A', 'R', 'S', 'Y']);

    await user.click(screen.getByRole('link', { name: 'Back to the map' }));
    expect(await screen.findByRole('heading', { name: '2 friends on the way' })).toBeInTheDocument();
  });
});

describe('Live map, sharing', () => {
  it('asks the host to share first, and only then watches the location', async () => {
    const user = userEvent.setup();
    const phone = withLocation();
    let sharing = false;
    serve([priya], {
      'GET /trips/trip-1/members': () => jsonResponse(200, [{ ...priya, sharing }]),
      'POST /trips/trip-1/sharing': () => {
        sharing = true;
        return new Response(null, { status: 204 });
      },
    });
    await openLiveMap();

    await user.click(await screen.findByRole('button', { name: 'Share my location' }));

    await waitFor(() => expect(phone.watchPosition).toHaveBeenCalled());
    expect(calls('POST /api/v1/trips/trip-1/sharing')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Share my location' })).not.toBeInTheDocument();
  });

  it('never watches the location of someone who hasn’t agreed', async () => {
    const phone = withLocation();
    serve([{ ...priya, sharing: false }]);
    await openLiveMap();

    await screen.findByRole('button', { name: 'Share my location' });
    expect(phone.watchPosition).not.toHaveBeenCalled();
  });

  it('explains how to fix a blocked location', async () => {
    const phone = withLocation();
    serve([priya]);
    await openLiveMap();
    await waitFor(() => expect(phone.watchPosition).toHaveBeenCalled());

    phone.deny();

    expect(screen.getByRole('alert')).toHaveTextContent(/Location is blocked for this site/);
  });
});
