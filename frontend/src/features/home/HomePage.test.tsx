import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatClock } from '../../lib/time';
import { jsonResponse, renderApp, sampleTrip, testUser } from '../../test/renderApp';
import { useSession } from '../auth/session';
import type { Trip } from '../trip/types';

const fetchMock = vi.fn<typeof fetch>();

function serve(trips: Trip[] = []) {
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith('/api/v1/trips')) return jsonResponse(200, trips);
    if (url === '/api/v1/places/recent') return jsonResponse(200, []);
    throw new Error(`Unexpected call: ${url}`);
  });
}

function withLocation(answer: 'granted' | 'denied') {
  const getCurrentPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) => {
    if (answer === 'granted') ok({ coords: { latitude: 18.56, longitude: 73.91 } } as GeolocationPosition);
    else fail({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
  });
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
  return getCurrentPosition;
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'geolocation');
});

describe('Home, signed in', () => {
  beforeEach(() => {
    useSession.setState({ status: 'signedIn', user: testUser, guest: null, accessToken: 't' });
  });

  it('offers a new trip, joining, search, settings and the profile', () => {
    serve();
    renderApp('/home');

    expect(screen.getByRole('heading', { level: 1, name: 'Ready for a trip?' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New trip' })).toHaveAttribute('href', '/trip/new/destination');
    expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute('href', '/join');
    expect(screen.getByRole('link', { name: /Where to\?/ })).toHaveAttribute('href', '/trip/new/destination');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/me/settings');
    expect(screen.getByRole('link', { name: 'Your profile, Priya' })).toHaveAttribute('href', '/me');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('lists live trips with friends and end time, each opening the trip', async () => {
    serve([
      { ...sampleTrip, id: 't1', role: 'host', memberCount: 4, expiresAt: '2026-11-17T16:00:00Z' },
      { ...sampleTrip, id: 't2', name: 'Sunday brunch', destination: null, role: 'member', memberCount: 1 },
    ]);
    renderApp('/home');

    const hosted = await screen.findByRole('link', { name: /Saturday at Phoenix/ });
    expect(hosted).toHaveAttribute('href', '/trip/t1/invite');
    expect(hosted).toHaveTextContent(
      `Live now · 3 friends · until ${formatClock('2026-11-17T16:00:00Z', '12h')}`,
    );
    const joined = screen.getByRole('link', { name: /Sunday brunch/ });
    expect(joined).toHaveAttribute('href', '/trip/t2');
    expect(joined).toHaveTextContent('Just you so far');
  });

  it('points to Trips when more trips are running than fit', async () => {
    serve(['a', 'b', 'c', 'd'].map((id) => ({ ...sampleTrip, id, name: `Trip ${id}`, destination: null })));
    renderApp('/home');

    expect(await screen.findByRole('link', { name: 'See all 4 live trips' })).toHaveAttribute(
      'href',
      '/me/history',
    );
    expect(screen.getAllByRole('link', { name: /^Trip / })).toHaveLength(3);
  });

  it('never asks for location by itself', async () => {
    serve();
    const ask = withLocation('granted');
    renderApp('/home');

    await screen.findByRole('heading', { name: 'Ready for a trip?' });
    expect(ask).not.toHaveBeenCalled();
  });

  it('asks for location when the recenter button is tapped', async () => {
    const user = userEvent.setup();
    serve();
    const ask = withLocation('granted');
    renderApp('/home');

    await user.click(screen.getByRole('button', { name: 'Show where I am' }));

    expect(ask).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('explains when location is blocked', async () => {
    const user = userEvent.setup();
    serve();
    withLocation('denied');
    renderApp('/home');

    await user.click(screen.getByRole('button', { name: 'Show where I am' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Location is blocked for this site.');
  });
});

describe('Home, not signed in', () => {
  it('invites someone exploring to sign up, log in or join with a code', async () => {
    useSession.setState({ status: 'signedOut', user: null, guest: null, accessToken: null });
    renderApp('/home');

    expect(screen.getByRole('heading', { level: 1, name: 'Ready for a trip?' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/signup');
    const panel = screen.getByRole('region', { name: 'Ready for a trip?' });
    expect(within(panel).getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Join a trip with a code' })).toHaveAttribute('href', '/join');
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });

  it('sends a guest back to their trip', () => {
    useSession.setState({
      status: 'guest',
      user: null,
      guest: { tripId: 'trip-1', memberId: 'm1', displayName: 'Sourav', color: '#185FA5' },
      accessToken: 'g',
    });
    renderApp('/home');

    expect(screen.getByRole('heading', { level: 1, name: 'You’re on a trip' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to your trip' })).toHaveAttribute('href', '/trip/trip-1');
  });
});
