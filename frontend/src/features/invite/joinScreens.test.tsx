import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderApp, sampleTrip, testUser } from '../../test/renderApp';
import { useSession } from '../auth/session';

const fetchMock = vi.fn<typeof fetch>();

const preview = {
  code: 'K7QX2P9T',
  tripName: 'Saturday at Phoenix',
  hostName: 'Priya',
  destination: sampleTrip.destination,
  memberCount: 3,
  expiresAt: '2026-11-12T14:00:00Z',
};

const joined = {
  tripId: 'trip-1',
  memberId: 'm1',
  displayName: 'Sourav',
  color: '#185FA5',
  role: 'member',
  sharingLocation: true,
  accessToken: 'guest-pass',
  expiresIn: 3600,
};

type Routes = Record<string, () => Response>;

/** Answers each API call by "METHOD path"; anything unexpected fails loudly. */
function serve(routes: Routes) {
  fetchMock.mockImplementation(async (input, init) => {
    const path = String(input).replace('/api/v1', '');
    const key = `${init?.method ?? 'GET'} ${path}`;
    const answer = routes[key];
    if (!answer) throw new Error(`Unexpected call: ${key}`);
    return answer();
  });
}

function calls(key: string) {
  return fetchMock.mock.calls.filter(([input, init]) => `${init?.method ?? 'GET'} ${String(input)}` === key);
}

function bodyOf(call: Parameters<typeof fetch>) {
  return JSON.parse(String(call[1]?.body)) as Record<string, unknown>;
}

function authorizationOf(call: Parameters<typeof fetch>) {
  return (call[1]?.headers as Record<string, string>).Authorization;
}

function signedOut() {
  useSession.setState({ status: 'signedOut', user: null, guest: null, accessToken: null });
}

beforeEach(() => {
  signedOut();
  window.localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  // jsdom has no native dialog or video; give them just enough.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'mediaDevices');
  Reflect.deleteProperty(navigator, 'geolocation');
});

describe('Join screen', () => {
  it('shows who invited you, with the code from the link filled in', async () => {
    serve({ 'GET /join/K7QX2P9T/preview': () => jsonResponse(200, preview) });
    renderApp('/join/K7QX2P9T');

    expect(await screen.findByText('Saturday at Phoenix')).toBeInTheDocument();
    expect(screen.getByText(/Priya invited you to/)).toBeInTheDocument();
    expect(screen.getByText(/3 friends already on the trip/)).toBeInTheDocument();
  });

  it('names the host when nobody else has joined yet', async () => {
    serve({ 'GET /join/K7QX2P9T/preview': () => jsonResponse(200, { ...preview, memberCount: 1 }) });
    renderApp('/join/K7QX2P9T');

    expect(await screen.findByText(/Just Priya so far/)).toBeInTheDocument();
    expect(screen.getByLabelText('Trip code')).toHaveValue('K7QX2P9T');
  });

  it('asks for a name before going on', async () => {
    const user = userEvent.setup();
    serve({ 'GET /join/K7QX2P9T/preview': () => jsonResponse(200, preview) });
    renderApp('/join/K7QX2P9T');

    await user.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription(
      'Enter your name so friends know who you are.',
    );
    await waitFor(() => expect(screen.getByLabelText('Your name')).toHaveFocus());
  });

  it('goes on to the consent screen with the name', async () => {
    const user = userEvent.setup();
    serve({ 'GET /join/K7QX2P9T/preview': () => jsonResponse(200, preview) });
    renderApp('/join/K7QX2P9T');

    await user.type(await screen.findByLabelText('Your name'), 'Sourav');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Share your live location?' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/join/K7QX2P9T/consent');
  });

  it('takes a typed code in any case, with spaces', async () => {
    const user = userEvent.setup();
    serve({ 'GET /join/K7QX2P9T/preview': () => jsonResponse(200, preview) });
    renderApp('/join');

    await user.type(screen.getByLabelText('Trip code'), 'k7qx 2p9t');

    expect(await screen.findByText('Saturday at Phoenix')).toBeInTheDocument();
  });

  it('explains a code of the wrong shape without asking the server', async () => {
    const user = userEvent.setup();
    renderApp('/join');

    await user.type(screen.getByLabelText('Your name'), 'Sourav');
    await user.type(screen.getByLabelText('Trip code'), 'ABC');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByLabelText('Trip code')).toHaveAccessibleDescription(
      'Trip codes have 8 letters and numbers, like K7QX2P9T.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says so when no trip has the code', async () => {
    serve({
      'GET /join/K7QX2P9T/preview': () =>
        jsonResponse(404, { code: 'INVALID_CODE', detail: "That code doesn't match a trip." }),
    });
    renderApp('/join/K7QX2P9T');

    await waitFor(() =>
      expect(screen.getByLabelText('Trip code')).toHaveAccessibleDescription(
        "That code doesn't match a trip. Check it and try again.",
      ),
    );
  });

  it('sends a link to an ended trip to the expired screen', async () => {
    serve({
      'GET /join/K7QX2P9T/preview': () =>
        jsonResponse(410, { code: 'TRIP_EXPIRED', detail: 'Ended.', endedAt: '2026-11-12T10:00:00Z' }),
    });
    renderApp('/join/K7QX2P9T');

    expect(await screen.findByRole('heading', { name: 'This trip has ended' })).toBeInTheDocument();
    expect(screen.getByText(/K7QX2P9T/).closest('p')).toHaveTextContent(/Code K7QX2P9T ended/);
  });

  it('lets someone signed in join without typing a name', async () => {
    useSession.setState({ status: 'signedIn', user: testUser, accessToken: 't' });
    serve({ 'GET /join/K7QX2P9T/preview': () => jsonResponse(200, preview) });
    renderApp('/join/K7QX2P9T');

    expect(await screen.findByText("You'll join as Priya, with your account.")).toBeInTheDocument();
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument();
  });

  it('sends a guest back to the trip they are already on', async () => {
    useSession.setState({
      status: 'guest',
      guest: { tripId: 'trip-1', memberId: 'm1', displayName: 'Sourav', color: '#185FA5' },
      accessToken: 'guest-pass',
    });
    serve({
      'GET /join/K7QX2P9T/preview': () => jsonResponse(200, preview),
      'GET /trips/trip-1': () => jsonResponse(200, { ...sampleTrip, role: 'member' }),
    });
    renderApp('/join/K7QX2P9T');

    expect(await screen.findByText("You're already on this trip as Sourav.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the trip' })).toHaveAttribute('href', '/trip/trip-1');
  });
});

describe('QR scanner', () => {
  function withCamera(getUserMedia: () => Promise<MediaStream>) {
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  }

  function withDetector(rawValue: string) {
    vi.stubGlobal(
      'BarcodeDetector',
      class {
        static getSupportedFormats = () => Promise.resolve(['qr_code']);
        detect = () => Promise.resolve([{ rawValue }]);
      },
    );
  }

  it('fills in the code from a scanned invite and turns the camera off', async () => {
    const user = userEvent.setup();
    const stop = vi.fn();
    withCamera(() => Promise.resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream));
    withDetector('https://squadmap.app/join/K7QX2P9T');
    serve({ 'GET /join/K7QX2P9T/preview': () => jsonResponse(200, preview) });
    renderApp('/join');

    await user.click(screen.getByRole('button', { name: 'Scan QR code' }));

    await waitFor(() => expect(screen.getByLabelText('Trip code')).toHaveValue('K7QX2P9T'));
    expect(stop).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Saturday at Phoenix')).toBeInTheDocument();
  });

  it('keeps looking when the QR code is not an invite', async () => {
    const user = userEvent.setup();
    withCamera(() => Promise.resolve({ getTracks: () => [] } as unknown as MediaStream));
    withDetector('https://example.com/menu');
    renderApp('/join');

    await user.click(screen.getByRole('button', { name: 'Scan QR code' }));

    const dialog = await screen.findByRole('dialog', { name: 'Scan the trip QR code' });
    expect(await within(dialog).findByText('That QR code isn’t a SquadMap invite.')).toBeInTheDocument();
    expect(screen.getByLabelText('Trip code')).toHaveValue('');
  });

  it('explains a blocked camera', async () => {
    const user = userEvent.setup();
    withCamera(() => Promise.reject(new DOMException('denied', 'NotAllowedError')));
    withDetector('');
    renderApp('/join');

    await user.click(screen.getByRole('button', { name: 'Scan QR code' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Camera access is blocked/);
  });

  it('explains a browser that cannot use the camera', async () => {
    const user = userEvent.setup();
    renderApp('/join');

    await user.click(screen.getByRole('button', { name: 'Scan QR code' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/can’t use the camera here/);
  });
});

describe('Consent screen', () => {
  function withLocation(answer: 'granted' | 'denied') {
    const getCurrentPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) => {
      if (answer === 'granted') ok({} as GeolocationPosition);
      else fail({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
    });
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
    return getCurrentPosition;
  }

  function atConsent(state: unknown = { displayName: 'Sourav' }) {
    return renderApp({ pathname: '/join/K7QX2P9T/consent', state });
  }

  it('makes the three promises', () => {
    atConsent();

    const list = screen.getByRole('list');
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Only people with the trip link see you',
      'Sharing stops when the trip ends',
      'Your location isn’t kept after the trip',
    ]);
  });

  it('joins sharing location once the browser allows it, and opens the trip', async () => {
    const user = userEvent.setup();
    const ask = withLocation('granted');
    serve({
      'POST /join/K7QX2P9T': () => jsonResponse(201, joined),
      'GET /trips/trip-1': () => jsonResponse(200, { ...sampleTrip, role: 'member' }),
    });
    atConsent();

    await user.click(screen.getByRole('button', { name: 'Share my location' }));

    expect(await screen.findByText('You joined as Sourav.')).toBeInTheDocument();
    expect(ask).toHaveBeenCalled();
    const [join] = calls('POST /api/v1/join/K7QX2P9T');
    expect(bodyOf(join!)).toEqual({ displayName: 'Sourav', shareLocation: true });
    expect(useSession.getState()).toMatchObject({ status: 'guest', accessToken: 'guest-pass' });
    expect(screen.getByTestId('location')).toHaveTextContent('/trip/trip-1');
  });

  it('"Not now" joins without sharing and never asks the browser', async () => {
    const user = userEvent.setup();
    const ask = withLocation('granted');
    serve({
      'POST /join/K7QX2P9T': () => jsonResponse(201, { ...joined, sharingLocation: false }),
      'GET /trips/trip-1': () => jsonResponse(200, { ...sampleTrip, role: 'member' }),
    });
    atConsent();

    await user.click(screen.getByRole('button', { name: 'Not now' }));

    await screen.findByText('You joined as Sourav.');
    expect(ask).not.toHaveBeenCalled();
    expect(bodyOf(calls('POST /api/v1/join/K7QX2P9T')[0]!)).toEqual({
      displayName: 'Sourav',
      shareLocation: false,
    });
  });

  it('explains blocked location and offers to join without sharing', async () => {
    const user = userEvent.setup();
    withLocation('denied');
    serve({
      'POST /join/K7QX2P9T': () => jsonResponse(201, { ...joined, sharingLocation: false }),
      'GET /trips/trip-1': () => jsonResponse(200, { ...sampleTrip, role: 'member' }),
    });
    atConsent();

    await user.click(screen.getByRole('button', { name: 'Share my location' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Location is blocked for this site/);
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Join without sharing' }));
    await screen.findByText('You joined as Sourav.');
    expect(bodyOf(calls('POST /api/v1/join/K7QX2P9T')[0]!)).toMatchObject({ shareLocation: false });
  });

  it('a guest of another trip joins as a new guest, without their old pass', async () => {
    const user = userEvent.setup();
    useSession.setState({
      status: 'guest',
      guest: { tripId: 'trip-0', memberId: 'm0', displayName: 'Sourav', color: '#185FA5' },
      accessToken: 'old-pass',
    });
    serve({
      'POST /join/K7QX2P9T': () => jsonResponse(201, joined),
      'GET /trips/trip-1': () => jsonResponse(200, { ...sampleTrip, role: 'member' }),
    });
    atConsent();

    await user.click(screen.getByRole('button', { name: 'Not now' }));

    await screen.findByText('You joined as Sourav.');
    expect(authorizationOf(calls('POST /api/v1/join/K7QX2P9T')[0]!)).toBeUndefined();
  });

  it('someone signed in joins with their account', async () => {
    const user = userEvent.setup();
    useSession.setState({ status: 'signedIn', user: testUser, accessToken: 't' });
    serve({
      'POST /join/K7QX2P9T': () => jsonResponse(201, { ...joined, accessToken: null, expiresIn: null }),
      'GET /trips/trip-1': () => jsonResponse(200, { ...sampleTrip, role: 'member' }),
    });
    atConsent(null);

    await user.click(screen.getByRole('button', { name: 'Not now' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/trip/trip-1'));
    const [join] = calls('POST /api/v1/join/K7QX2P9T');
    expect(authorizationOf(join!)).toBe('Bearer t');
    expect(bodyOf(join!)).toEqual({ shareLocation: false });
    expect(useSession.getState().status).toBe('signedIn');
  });

  it('says when the trip is full', async () => {
    const user = userEvent.setup();
    serve({
      'POST /join/K7QX2P9T': () =>
        jsonResponse(409, { code: 'TRIP_FULL', detail: 'This trip is full: it already has 10 people.' }),
    });
    atConsent();

    await user.click(screen.getByRole('button', { name: 'Not now' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This trip is full: it already has 10 people.',
    );
  });

  it('starts at the Join screen when opened without a name', () => {
    serve({ 'GET /join/K7QX2P9T/preview': () => jsonResponse(200, preview) });
    atConsent(null);

    expect(screen.getByRole('heading', { name: 'Join the trip' })).toBeInTheDocument();
  });
});

describe('Expired screen', () => {
  it('works without details, for a bare visit', () => {
    renderApp('/join/expired');

    expect(screen.getByRole('heading', { name: 'This trip has ended' })).toBeInTheDocument();
    expect(screen.queryByText(/^Code/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start my own trip' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Enter a different code' })).toHaveAttribute('href', '/join');
  });
});

describe('a guest on the trip', () => {
  const asGuest = () =>
    useSession.setState({
      status: 'guest',
      guest: { tripId: 'trip-1', memberId: 'm1', displayName: 'Sourav', color: '#185FA5' },
      accessToken: 'guest-pass',
    });

  it('can open their own trip', async () => {
    asGuest();
    serve({ 'GET /trips/trip-1': () => jsonResponse(200, { ...sampleTrip, role: 'member' }) });
    renderApp('/trip/trip-1');

    expect(await screen.findByRole('heading', { name: 'Saturday at Phoenix' })).toBeInTheDocument();
  });

  it('is sent back to it from pages for accounts', async () => {
    asGuest();
    serve({ 'GET /trips/trip-1': () => jsonResponse(200, { ...sampleTrip, role: 'member' }) });
    renderApp('/trip/trip-9/invite');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/trip/trip-1'));
  });

  it('is told the trip has ended when their pass could not be picked up', () => {
    useSession.setState({ status: 'signedOut', guestEnded: true });
    renderApp('/trip/trip-1');

    expect(screen.getByRole('heading', { name: 'This trip has ended' })).toBeInTheDocument();
  });

  it('can leave, which also forgets them on this device', async () => {
    const user = userEvent.setup();
    asGuest();
    serve({
      'GET /trips/trip-1': () => jsonResponse(200, { ...sampleTrip, role: 'member' }),
      'DELETE /trips/trip-1/members/me': () => new Response(null, { status: 204 }),
      'POST /guest/logout': () => new Response(null, { status: 204 }),
    });
    renderApp('/trip/trip-1');

    await user.click(await screen.findByRole('button', { name: 'Leave trip' }));

    await waitFor(() => expect(useSession.getState().status).toBe('signedOut'));
    expect(calls('POST /api/v1/guest/logout')).toHaveLength(1);
  });
});
