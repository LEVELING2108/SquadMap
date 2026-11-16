import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDistance } from '../../lib/map/geo';
import { jsonResponse, renderApp, sampleTrip, testUser } from '../../test/renderApp';
import { useSession } from '../auth/session';
import { resetTripDraft, setDraftDestination, suggestedName, useTripDraft } from './tripDraft';

/** The map itself needs WebGL; here it is a stand-in that can "move" and can fail to load. */
const map = vi.hoisted(() => ({ loads: true }));
vi.mock('../../lib/map/MapView', async () => {
  const { useEffect } = await import('react');
  return {
    DestinationPin: () => null,
    MapView: ({
      label,
      onCenterChange,
      onReady,
    }: {
      label: string;
      onCenterChange?: (c: { lat: number; lng: number }) => void;
      onReady?: (real: boolean) => void;
    }) => {
      useEffect(() => onReady?.(map.loads), [onReady]);
      return (
        <div role="img" aria-label={label}>
          <button type="button" onClick={() => onCenterChange?.({ lat: 18.6, lng: 73.8 })}>
            Move map
          </button>
        </div>
      );
    },
  };
});

const fetchMock = vi.fn<typeof fetch>();

type Routes = Record<string, (init?: RequestInit) => Response>;

function serve(routes: Routes) {
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input).replace('/api/v1', '');
    const path = url.split('?')[0];
    const key = `${init?.method ?? 'GET'} ${path}`;
    const answer = routes[key];
    if (!answer) throw new Error(`Unexpected call: ${key}`);
    return answer(init);
  });
}

function callsTo(method: string, path: string) {
  return fetchMock.mock.calls.filter(
    ([input, init]) => (init?.method ?? 'GET') === method && String(input).split('?')[0] === `/api/v1${path}`,
  );
}

const phoenix = {
  id: 'p1',
  name: 'Phoenix Marketcity',
  address: 'Viman Nagar, Pune, India',
  lat: 18.5622,
  lng: 73.9167,
  kind: 'poi',
  distanceMeters: 6200,
};
const lonavala = {
  id: null,
  name: 'Lonavala Viewpoint',
  address: null,
  lat: 18.75,
  lng: 73.4,
  kind: 'recent',
  distanceMeters: null,
};

beforeEach(() => {
  useSession.setState({ status: 'signedIn', user: testUser, guest: null, accessToken: 't' });
  resetTripDraft();
  map.loads = true;
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('Destination screen', () => {
  it('shows recent places before anything is typed', async () => {
    serve({ 'GET /places/recent': () => jsonResponse(200, [lonavala]) });
    renderApp('/trip/new/destination');

    const recent = await screen.findByRole('region', { name: 'RECENT' });
    expect(within(recent).getByRole('button', { name: /Lonavala Viewpoint/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Search for a place')).toHaveFocus();
  });

  it('searches once typing pauses and shows each place with its distance', async () => {
    const user = userEvent.setup();
    serve({
      'GET /places/recent': () => jsonResponse(200, []),
      'GET /places/search': () => jsonResponse(200, [phoenix]),
    });
    renderApp('/trip/new/destination');

    await user.type(screen.getByLabelText('Search for a place'), 'phoenix');

    const results = await screen.findByRole('list', { name: 'Places found' });
    expect(within(results).getByRole('button')).toHaveTextContent('Viman Nagar, Pune, India · 6.2 km');
    expect(screen.getByRole('status')).toHaveTextContent('1 place found');
    // Only the finished word was searched for, not every letter.
    const searches = callsTo('GET', '/places/search');
    expect(searches).toHaveLength(1);
    expect(String(searches[0]![0])).toBe('/api/v1/places/search?q=phoenix');
  });

  it('a picked search result goes to the new trip, to be confirmed when the trip is created', async () => {
    const user = userEvent.setup();
    serve({
      'GET /places/recent': () => jsonResponse(200, []),
      'GET /places/search': () => jsonResponse(200, [phoenix]),
    });
    renderApp('/trip/new/destination');

    await user.type(screen.getByLabelText('Search for a place'), 'phoenix');
    await user.click(await screen.findByRole('button', { name: /Phoenix Marketcity/ }));

    expect(await screen.findByRole('heading', { name: 'Plan your trip' })).toBeInTheDocument();
    expect(useTripDraft.getState().destination).toMatchObject({
      name: 'Phoenix Marketcity',
      fromSearch: true,
    });
  });

  it('a recent place is used as it is', async () => {
    const user = userEvent.setup();
    serve({ 'GET /places/recent': () => jsonResponse(200, [lonavala]) });
    renderApp('/trip/new/destination');

    await user.click(await screen.findByRole('button', { name: /Lonavala Viewpoint/ }));

    expect(useTripDraft.getState().destination).toMatchObject({
      name: 'Lonavala Viewpoint',
      fromSearch: false,
    });
  });

  it('says when nothing matches', async () => {
    const user = userEvent.setup();
    serve({
      'GET /places/recent': () => jsonResponse(200, []),
      'GET /places/search': () => jsonResponse(200, []),
    });
    renderApp('/trip/new/destination');

    await user.type(screen.getByLabelText('Search for a place'), 'zzzz');

    expect(
      await screen.findByText('No places match. Try another name, or choose on the map.'),
    ).toBeInTheDocument();
  });

  it('offers the map when place search is unavailable', async () => {
    const user = userEvent.setup();
    serve({
      'GET /places/recent': () => jsonResponse(200, []),
      'GET /places/search': () => jsonResponse(503, { code: 'PLACES_UNAVAILABLE', detail: 'Down.' }),
    });
    renderApp('/trip/new/destination');

    await user.type(screen.getByLabelText('Search for a place'), 'pune');

    expect(await screen.findByRole('alert')).toHaveTextContent('You can choose the spot on the map instead.');
    expect(screen.getByRole('link', { name: 'Choose on map' })).toHaveAttribute('href', '/trip/new/map');
  });

  it('clearing the search brings recent places back', async () => {
    const user = userEvent.setup();
    serve({
      'GET /places/recent': () => jsonResponse(200, [lonavala]),
      'GET /places/search': () => jsonResponse(200, [phoenix]),
    });
    renderApp('/trip/new/destination');
    await user.type(screen.getByLabelText('Search for a place'), 'phoenix');
    await screen.findByRole('list', { name: 'Places found' });

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(await screen.findByRole('region', { name: 'RECENT' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search for a place')).toHaveValue('');
    expect(screen.getByLabelText('Search for a place')).toHaveFocus();
  });

  it('can skip the destination', async () => {
    const user = userEvent.setup();
    serve({ 'GET /places/recent': () => jsonResponse(200, []) });
    renderApp('/trip/new/destination');

    await user.click(screen.getByRole('button', { name: 'Skip, no destination' }));

    expect(await screen.findByText('No destination')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a destination' })).toHaveAttribute(
      'href',
      '/trip/new/destination',
    );
  });
});

describe('Choose on map', () => {
  it('uses the spot under the pin, with the name given', async () => {
    const user = userEvent.setup();
    renderApp('/trip/new/map');

    await user.click(screen.getByRole('button', { name: 'Move map' }));
    await user.clear(screen.getByLabelText('Name this spot'));
    await user.type(screen.getByLabelText('Name this spot'), 'Gate 3');
    await user.click(screen.getByRole('button', { name: 'Use this spot' }));

    expect(await screen.findByRole('heading', { name: 'Plan your trip' })).toBeInTheDocument();
    expect(useTripDraft.getState().destination).toEqual({
      name: 'Gate 3',
      address: null,
      lat: 18.6,
      lng: 73.8,
      fromSearch: false,
    });
  });

  it('asks for a name', async () => {
    const user = userEvent.setup();
    renderApp('/trip/new/map');

    await user.clear(screen.getByLabelText('Name this spot'));
    await user.click(screen.getByRole('button', { name: 'Use this spot' }));

    expect(screen.getByLabelText('Name this spot')).toHaveAccessibleDescription(
      'Give this spot a name friends will recognise.',
    );
  });

  it('sends people to search when the map cannot load', async () => {
    map.loads = false;
    renderApp('/trip/new/map');

    expect(await screen.findByRole('alert')).toHaveTextContent('The map couldn’t load here');
    expect(screen.getByRole('link', { name: 'Search for a place' })).toHaveAttribute(
      'href',
      '/trip/new/destination',
    );
  });
});

describe('New trip screen', () => {
  const created = { ...sampleTrip, id: 'trip-9' };

  it('suggests a name from the day and the place', () => {
    const monday = new Date('2026-11-16T10:00:00');
    expect(suggestedName({ ...phoenix, fromSearch: true }, monday)).toBe('Monday at Phoenix Marketcity');
    expect(suggestedName(null, monday)).toBe('Monday trip');
  });

  it('creates the trip with the choices made, once, and opens its invite', async () => {
    const user = userEvent.setup();
    setDraftDestination({ ...phoenix, fromSearch: true });
    const key = useTripDraft.getState().idempotencyKey;
    serve({
      'POST /trips': () => jsonResponse(201, created),
      'GET /trips/trip-9': () => jsonResponse(200, created),
      'GET /trips': () => jsonResponse(200, [created]),
    });
    renderApp('/trip/new');

    expect(screen.getByRole('img', { name: 'Map showing Phoenix Marketcity' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '2 hours' }));
    await user.click(screen.getByRole('switch', { name: 'Friends can chat' }));
    await user.click(screen.getByRole('button', { name: 'Create trip and invite' }));

    expect(await screen.findByRole('heading', { name: 'Trip is live' })).toBeInTheDocument();
    const [post] = callsTo('POST', '/trips');
    expect(JSON.parse(String(post![1]!.body))).toEqual({
      name: suggestedName({ ...phoenix, fromSearch: true }),
      shareHours: 2,
      chatEnabled: false,
      destination: { name: 'Phoenix Marketcity', lat: 18.5622, lng: 73.9167, fromSearch: true },
    });
    expect((post![1]!.headers as Record<string, string>)['Idempotency-Key']).toBe(key);
    // A new draft starts fresh.
    expect(useTripDraft.getState()).toMatchObject({
      destination: undefined,
      shareHours: 4,
      chatEnabled: true,
    });
    expect(useTripDraft.getState().idempotencyKey).not.toBe(key);
  });

  it('starts a trip without a destination', async () => {
    const user = userEvent.setup();
    setDraftDestination(null);
    serve({
      'POST /trips': () => jsonResponse(201, created),
      'GET /trips/trip-9': () => jsonResponse(200, created),
      'GET /trips': () => jsonResponse(200, [created]),
    });
    renderApp('/trip/new');

    await user.click(screen.getByRole('button', { name: 'Create trip and invite' }));

    await screen.findByRole('heading', { name: 'Trip is live' });
    expect(JSON.parse(String(callsTo('POST', '/trips')[0]![1]!.body))).toMatchObject({ destination: null });
  });

  it('moves between hours with the arrow keys', async () => {
    const user = userEvent.setup();
    renderApp('/trip/new');

    screen.getByRole('radio', { name: '4 hours' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('radio', { name: '8 hours' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '8 hours' })).toHaveFocus();
  });

  it('needs a trip name', async () => {
    const user = userEvent.setup();
    renderApp('/trip/new');

    await user.clear(screen.getByLabelText('Trip name'));
    await user.click(screen.getByRole('button', { name: 'Create trip and invite' }));

    expect(screen.getByLabelText('Trip name')).toHaveAccessibleDescription('Give the trip a name.');
    await waitFor(() => expect(screen.getByLabelText('Trip name')).toHaveFocus());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('explains a place that could not be confirmed and keeps the choices', async () => {
    const user = userEvent.setup();
    setDraftDestination({ ...phoenix, fromSearch: true });
    serve({
      'POST /trips': () =>
        jsonResponse(422, {
          code: 'PLACE_NOT_CONFIRMED',
          detail: "We couldn't confirm that place. Search for it again, or drop a pin on the map.",
        }),
    });
    renderApp('/trip/new');

    await user.click(screen.getByRole('button', { name: 'Create trip and invite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't confirm that place.");
    expect(screen.getByRole('link', { name: 'Change destination' })).toBeInTheDocument();
    expect(useTripDraft.getState().destination).toMatchObject({ name: 'Phoenix Marketcity' });
  });

  it('says when too many trips are running', async () => {
    const user = userEvent.setup();
    serve({
      'POST /trips': () =>
        jsonResponse(409, {
          code: 'TOO_MANY_TRIPS',
          detail: 'You already have 3 trips running. End one to start another.',
        }),
    });
    renderApp('/trip/new');

    await user.click(screen.getByRole('button', { name: 'Create trip and invite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You already have 3 trips running.');
  });
});

describe('formatDistance', () => {
  it.each([
    [4, '10 m'],
    [460, '460 m'],
    [6200, '6.2 km'],
    [6000, '6 km'],
    [24_400, '24 km'],
    [null, null],
  ])('%s m reads %j', (meters, words) => {
    expect(formatDistance(meters)).toBe(words);
  });
});
