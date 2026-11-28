import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lastClient } from '../../test/fakeStomp';
import { jsonResponse, renderApp, sampleTrip, testUser } from '../../test/renderApp';
import { useSession } from '../auth/session';
import type { Trip } from '../trip/types';
import type { LiveMember } from './liveTypes';
import { useLiveStore } from './liveStore';

const fetchMock = vi.fn<typeof fetch>();
const EVENTS = '/topic/trip.trip-1.events';
const HOUR = 3_600_000;

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
const aman: LiveMember = { ...priya, memberId: 'm-aman', displayName: 'Aman', role: 'member', you: false };

type Answer = (init: RequestInit | undefined) => Response | Promise<Response>;

/** A trip that started an hour ago and shares for `leftMs` more. */
function tripWith(leftMs: number, extra: Partial<Trip> = {}): Trip {
  const now = Date.now();
  return {
    ...sampleTrip,
    startsAt: new Date(now - HOUR).toISOString(),
    expiresAt: new Date(now + leftMs).toISOString(),
    ...extra,
  };
}

function serve(trip: Trip, routes: Record<string, Answer> = {}) {
  let current = trip;
  const all: Record<string, Answer> = {
    'GET /trips/trip-1': () => jsonResponse(200, current),
    'GET /trips/trip-1/members': () => jsonResponse(200, [priya, aman]),
    'GET /trips/trip-1/eta': () => jsonResponse(200, []),
    'GET /trips/trip-1/summary': () =>
      jsonResponse(200, {
        id: 'trip-1',
        name: current.name,
        destination: current.destination,
        status: 'ended',
        role: current.role,
        startsAt: current.startsAt,
        endedAt: new Date().toISOString(),
        durationSeconds: 600,
        friendCount: 1,
        distanceM: null,
        arrivedAt: null,
      }),
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
  return { setTrip: (next: Trip) => (current = next) };
}

const calls = (key: string) =>
  fetchMock.mock.calls.filter(([input, init]) => `${init?.method ?? 'GET'} ${String(input)}` === key);

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
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('Trip menu', () => {
  it('opens from the top bar with the host’s actions', async () => {
    serve(tripWith(3 * HOUR));
    await open('/trip/trip-1');

    expect(await screen.findByRole('link', { name: 'Trip menu' })).toHaveAttribute(
      'href',
      '/trip/trip-1/menu',
    );
  });

  it('lists the host’s actions: invite, who’s on the way, extend, settings and end', async () => {
    serve(tripWith(3 * HOUR));
    await open('/trip/trip-1/menu');

    const menu = await screen.findByRole('region', { name: 'Saturday at Phoenix' });
    expect(within(menu).getByText('K7QX2P9T')).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Invite friends' })).toHaveAttribute(
      'href',
      '/trip/trip-1/invite',
    );
    expect(within(menu).getByRole('link', { name: "Who's on the way" })).toHaveAttribute(
      'href',
      '/trip/trip-1/eta',
    );
    expect(within(menu).getByRole('button', { name: /Extend sharing time.*3 h left/ })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/me/settings');
    expect(within(menu).getByRole('button', { name: 'End trip for everyone' })).toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: 'Leave trip' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Close the menu' })).toHaveAttribute('href', '/trip/trip-1');
    // The top bar's menu button isn't offered again while the menu is open.
    expect(screen.queryByRole('link', { name: 'Trip menu' })).not.toBeInTheDocument();
  });

  it('lets anyone else see the time left and leave, but not extend or end', async () => {
    serve(tripWith(3 * HOUR, { role: 'member' }));
    await open('/trip/trip-1/menu');

    const menu = await screen.findByRole('region', { name: 'Saturday at Phoenix' });
    expect(within(menu).getByText('3 h left. Only the host can add more.')).toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: /Extend/ })).not.toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: 'End trip for everyone' })).not.toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: 'Leave trip' })).toBeInTheDocument();
  });

  it('offers a guest the invite but no settings', async () => {
    useSession.setState({
      status: 'guest',
      user: null,
      guest: { tripId: 'trip-1', memberId: 'm-aman', displayName: 'Aman', color: '#993C1D' },
      accessToken: 't',
    });
    serve(tripWith(3 * HOUR, { role: 'member' }));
    await open('/trip/trip-1/menu');

    const menu = await screen.findByRole('region', { name: 'Saturday at Phoenix' });
    expect(within(menu).getByRole('link', { name: 'Invite friends' })).toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  });
});

describe('Extend sharing time', () => {
  it('adds the chosen time and says when sharing now ends', async () => {
    const user = userEvent.setup();
    const server = serve(tripWith(3 * HOUR), {
      'POST /trips/trip-1/extend': (init) => {
        const { minutes } = JSON.parse(String(init?.body)) as { minutes: number };
        const longer = tripWith(3 * HOUR + minutes * 60_000);
        server.setTrip(longer);
        return jsonResponse(200, longer);
      },
    });
    await open('/trip/trip-1/menu');

    await user.click(await screen.findByRole('button', { name: /Extend sharing time/ }));
    const dialog = screen.getByRole('dialog', { name: 'Extend sharing time' });
    expect(within(dialog).getByRole('radio', { name: '1 hour' })).toBeChecked();
    await user.click(within(dialog).getByRole('radio', { name: '2 hours' }));
    await user.click(within(dialog).getByRole('button', { name: 'Extend sharing' }));

    expect(await screen.findByText(/^Sharing now ends at /)).toBeInTheDocument();
    expect(JSON.parse(String(calls('POST /api/v1/trips/trip-1/extend')[0]?.[1]?.body))).toEqual({
      minutes: 120,
    });
    expect(screen.queryByRole('dialog', { name: 'Extend sharing time' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Extend sharing time.*5 h left/ })).toBeInTheDocument();
  });

  it('can’t go past 12 hours in total', async () => {
    const user = userEvent.setup();
    // An hour in, 10 h 15 min to go: 45 minutes more is all that fits.
    serve(tripWith(10.25 * HOUR));
    await open('/trip/trip-1/menu');

    await user.click(await screen.findByRole('button', { name: /Extend sharing time/ }));
    const dialog = screen.getByRole('dialog', { name: 'Extend sharing time' });
    expect(within(dialog).getByRole('radio', { name: '30 minutes' })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: '1 hour' })).toBeDisabled();
    expect(within(dialog).getByRole('radio', { name: '2 hours' })).toBeDisabled();
    expect(
      within(dialog).getByText(
        'A trip can share for 12 hours at most, so this one can add up to 45 minutes.',
      ),
    ).toBeInTheDocument();
  });

  it('says so when the trip already shares for 12 hours', async () => {
    const user = userEvent.setup();
    serve(tripWith(11 * HOUR));
    await open('/trip/trip-1/menu');

    await user.click(await screen.findByRole('button', { name: /Extend sharing time/ }));
    const dialog = screen.getByRole('dialog', { name: 'Extend sharing time' });
    expect(
      within(dialog).getByText('This trip has reached 12 hours, the longest a trip can share.'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Extend sharing' })).not.toBeInTheDocument();
  });

  it('shows why an extension failed', async () => {
    const user = userEvent.setup();
    serve(tripWith(3 * HOUR), {
      'POST /trips/trip-1/extend': () =>
        jsonResponse(409, { code: 'EXTEND_LIMIT', detail: 'A trip can share for 12 hours at most.' }),
    });
    await open('/trip/trip-1/menu');

    await user.click(await screen.findByRole('button', { name: /Extend sharing time/ }));
    const dialog = screen.getByRole('dialog', { name: 'Extend sharing time' });
    await user.click(within(dialog).getByRole('button', { name: 'Extend sharing' }));

    expect(await within(dialog).findByText('A trip can share for 12 hours at most.')).toBeInTheDocument();
  });
});

describe('End trip', () => {
  it('asks first, then ends the trip for everyone', async () => {
    const user = userEvent.setup();
    const server = serve(tripWith(3 * HOUR), {
      'POST /trips/trip-1/end': () => {
        const ended = tripWith(3 * HOUR, { status: 'ended' });
        server.setTrip(ended);
        return jsonResponse(200, ended);
      },
    });
    await open('/trip/trip-1/menu');

    await user.click(await screen.findByRole('button', { name: 'End trip for everyone' }));
    const dialog = screen.getByRole('dialog', { name: 'End this trip for everyone?' });
    expect(
      within(dialog).getByText(
        'Your friend stops sharing location right away and the invite link stops working.',
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'End trip' }));

    expect(await screen.findByRole('heading', { name: 'Trip complete' })).toBeInTheDocument();
    expect(calls('POST /api/v1/trips/trip-1/end')).toHaveLength(1);
  });

  it('moves on to Trip complete when the trip ends while the menu is open', async () => {
    const server = serve(tripWith(3 * HOUR, { role: 'member' }));
    const client = await open('/trip/trip-1/menu');
    await screen.findByRole('region', { name: 'Saturday at Phoenix' });

    server.setTrip(tripWith(3 * HOUR, { role: 'member', status: 'ended' }));
    act(() => client.deliver(EVENTS, { type: 'TRIP_ENDED', at: '' }));

    expect(await screen.findByRole('heading', { name: 'Trip complete' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/trip\/trip-1\/ended$/));
  });

  it('keeps sharing when the host changes their mind', async () => {
    const user = userEvent.setup();
    serve(tripWith(3 * HOUR));
    await open('/trip/trip-1/menu');

    await user.click(await screen.findByRole('button', { name: 'End trip for everyone' }));
    await user.click(screen.getByRole('button', { name: 'Keep sharing' }));

    expect(screen.queryByRole('dialog', { name: 'End this trip for everyone?' })).not.toBeInTheDocument();
    expect(calls('POST /api/v1/trips/trip-1/end')).toHaveLength(0);
  });
});

describe('Leave trip', () => {
  it('asks first, then leaves and goes home', async () => {
    const user = userEvent.setup();
    serve(tripWith(3 * HOUR, { role: 'member' }), {
      'DELETE /trips/trip-1/members/me': () => new Response(null, { status: 204 }),
      'GET /trips?status=active': () => jsonResponse(200, []),
    });
    await open('/trip/trip-1/menu');

    await user.click(await screen.findByRole('button', { name: 'Leave trip' }));
    const dialog = screen.getByRole('dialog', { name: 'Leave this trip?' });
    await user.click(within(dialog).getByRole('button', { name: 'Leave trip' }));

    await waitFor(() => expect(calls('DELETE /api/v1/trips/trip-1/members/me')).toHaveLength(1));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/home$/));
  });
});

describe('Sharing ends soon', () => {
  it('warns the host ten minutes before, with ways to extend or end', async () => {
    const user = userEvent.setup();
    serve(tripWith(8 * 60_000));
    await open('/trip/trip-1');

    const warning = await screen.findByRole('dialog', { name: 'Sharing ends in 8 min' });
    expect(
      within(warning).getByText(/^Your location will stop being shared with friends at /),
    ).toBeInTheDocument();
    expect(within(warning).getByRole('button', { name: 'Extend sharing' })).toBeInTheDocument();

    await user.click(within(warning).getByRole('button', { name: 'End now' }));
    expect(screen.getByRole('dialog', { name: 'End this trip for everyone?' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Sharing ends in 8 min' })).not.toBeInTheDocument();
  });

  it('tells everyone else when it ends, and only once', async () => {
    const user = userEvent.setup();
    serve(tripWith(8 * 60_000, { role: 'member' }));
    await open('/trip/trip-1');

    const warning = await screen.findByRole('dialog', { name: 'Sharing ends in 8 min' });
    expect(within(warning).getByText(/Only the host can add more time\.$/)).toBeInTheDocument();
    expect(within(warning).queryByRole('button', { name: 'Extend sharing' })).not.toBeInTheDocument();

    await user.click(within(warning).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('dialog', { name: /Sharing ends in/ })).not.toBeInTheDocument();
  });

  it('warns again for a new end time after the host adds a little', async () => {
    const user = userEvent.setup();
    const server = serve(tripWith(8 * 60_000, { role: 'member' }));
    const client = await open('/trip/trip-1');

    await user.click(
      within(await screen.findByRole('dialog', { name: 'Sharing ends in 8 min' })).getByRole('button', {
        name: 'Dismiss',
      }),
    );

    server.setTrip(tripWith(8.5 * 60_000, { role: 'member' }));
    act(() => client.deliver(EVENTS, { type: 'TRIP_EXTENDED', memberId: null, displayName: null, at: '' }));

    expect(await screen.findByRole('dialog', { name: 'Sharing ends in 9 min' })).toBeInTheDocument();
  });

  it('stays away while more than ten minutes are left', async () => {
    serve(tripWith(11 * 60_000));
    await open('/trip/trip-1');

    await screen.findByRole('link', { name: 'Trip menu' });
    expect(screen.queryByRole('dialog', { name: /Sharing ends in/ })).not.toBeInTheDocument();
  });
});
