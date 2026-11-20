import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pushNotification } from '../features/alerts/alertWords';
import { PushAlerts } from '../features/alerts/PushAlerts';
import { signOut, useSession } from '../features/auth/session';
import { jsonResponse, testUser } from '../test/renderApp';
import { useInstall } from './installPrompt';
import { NotificationTaps } from './NotificationTaps';
import { checkPush, listenForSignOut, syncPush, usePush } from './push';

const SERVER_KEY = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
const OLD_KEY = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';

function bytes(key: string): ArrayBuffer {
  const base64 = key.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0)).buffer;
}

/** A pretend browser push subscription. */
function subscription(endpoint: string, key = SERVER_KEY) {
  return {
    endpoint,
    options: { applicationServerKey: bytes(key) },
    toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn(async () => {
      browser.current = null;
      return true;
    }),
  };
}

const browser: {
  current: ReturnType<typeof subscription> | null;
  permission: NotificationPermission;
  answer: NotificationPermission;
  worker: boolean;
} = { current: null, permission: 'default', answer: 'granted', worker: true };

const pushManager = {
  getSubscription: vi.fn(async () => browser.current),
  subscribe: vi.fn(async () => {
    browser.current = subscription('https://fcm.googleapis.com/fcm/send/new');
    return browser.current;
  }),
};

const fetchMock = vi.fn<typeof fetch>();
const calls = () =>
  fetchMock.mock.calls.map(
    ([input, init]) => `${init?.method ?? 'GET'} ${String(input).replace('/api/v1', '')}`,
  );

let settings: Record<string, unknown>;

function serve() {
  fetchMock.mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input).replace('/api/v1', '')}`;
    if (key === 'GET /me/push/key') return jsonResponse(200, { publicKey: SERVER_KEY });
    if (key === 'POST /me/push/subscribe' || key === 'POST /me/push/unsubscribe') {
      return new Response(null, { status: 204 });
    }
    if (key === 'GET /me/settings') return jsonResponse(200, settings);
    if (key === 'PATCH /me/settings') {
      settings = { ...settings, ...(JSON.parse(String(init?.body)) as object) };
      return jsonResponse(200, settings);
    }
    if (key === 'POST /auth/logout') return new Response(null, { status: 204 });
    throw new Error(`Unexpected call: ${key}`);
  });
}

beforeEach(() => {
  browser.current = null;
  browser.permission = 'default';
  browser.answer = 'granted';
  browser.worker = true;
  settings = {
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
  usePush.setState({ support: 'checking', on: false, busy: false, problem: null });
  useInstall.setState({ offer: null, installed: false });
  useSession.setState({ status: 'signedIn', user: testUser, guest: null, accessToken: 't' });
  serve();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('PushManager', function PushManager() {});
  const notification = Object.defineProperties(function Notification() {}, {
    permission: { get: () => browser.permission },
    requestPermission: {
      value: vi.fn(async () => {
        browser.permission = browser.answer;
        return browser.answer;
      }),
    },
  });
  vi.stubGlobal('Notification', notification);
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      getRegistration: vi.fn(async () => (browser.worker ? { active: {}, pushManager } : undefined)),
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

function renderSwitches() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PushAlerts />
    </QueryClientProvider>,
  );
}

const mainSwitch = () => screen.getByRole('switch', { name: 'Notifications on this device' });

describe('Push alerts on the Alerts screen', () => {
  it('turns notifications on after the browser allows them, and tells the server', async () => {
    renderSwitches();

    await userEvent.click(await screen.findByRole('switch', { name: 'Notifications on this device' }));

    await waitFor(() => expect(mainSwitch()).toHaveAttribute('aria-checked', 'true'));
    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(calls()).toContain('POST /me/push/subscribe');
    const sent = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/me/push/subscribe'));
    expect(JSON.parse(String(sent?.[1]?.body))).toMatchObject({
      endpoint: 'https://fcm.googleapis.com/fcm/send/new',
      keys: { p256dh: 'p', auth: 'a' },
    });
  });

  it('shows which alerts send a notification once they are on, with the chosen defaults', async () => {
    browser.permission = 'granted';
    browser.current = subscription('https://fcm.googleapis.com/fcm/send/old');
    renderSwitches();

    expect(await screen.findByRole('switch', { name: 'Friend joins' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Friend leaves' })).toHaveAttribute('aria-checked', 'false'),
    );
    expect(screen.getByRole('switch', { name: 'Sharing ends soon' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Trip ended' })).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(screen.getByRole('switch', { name: 'Friend leaves' }));

    await waitFor(() => expect(settings.pushLeft).toBe(true));
  });

  it('hides the choices while notifications are off', async () => {
    renderSwitches();

    await screen.findByRole('switch', { name: 'Notifications on this device' });
    expect(screen.queryByRole('switch', { name: 'Friend joins' })).not.toBeInTheDocument();
  });

  it('stays off when the browser is told no, and explains how to allow them', async () => {
    browser.answer = 'denied';
    renderSwitches();

    await userEvent.click(await screen.findByRole('switch', { name: 'Notifications on this device' }));

    expect(await screen.findByText(/Notifications are blocked for SquadMap/)).toBeInTheDocument();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(calls()).not.toContain('POST /me/push/subscribe');
  });

  it('stays off without a word when the question is dismissed', async () => {
    browser.answer = 'default';
    renderSwitches();

    await userEvent.click(await screen.findByRole('switch', { name: 'Notifications on this device' }));

    await waitFor(() => expect(mainSwitch()).toHaveAttribute('aria-checked', 'false'));
    expect(mainSwitch()).not.toHaveAttribute('aria-disabled');
  });

  it('turns them off here and on the server', async () => {
    browser.permission = 'granted';
    const current = subscription('https://fcm.googleapis.com/fcm/send/old');
    browser.current = current;
    renderSwitches();

    await waitFor(() => expect(mainSwitch()).toHaveAttribute('aria-checked', 'true'));
    await userEvent.click(mainSwitch());

    await waitFor(() => expect(mainSwitch()).toHaveAttribute('aria-checked', 'false'));
    expect(current.unsubscribe).toHaveBeenCalled();
    const sent = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/me/push/unsubscribe'));
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({
      endpoint: 'https://fcm.googleapis.com/fcm/send/old',
    });
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('offline');
    });
    renderSwitches();

    await userEvent.click(await screen.findByRole('switch', { name: 'Notifications on this device' }));

    expect(await screen.findByText(/couldn’t be turned on/)).toBeInTheDocument();
    expect(mainSwitch()).toHaveAttribute('aria-checked', 'false');
  });

  it('on an iPhone outside the home-screen app, says to add it first', async () => {
    browser.worker = false;
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    );
    renderSwitches();

    expect(await screen.findByText(/add SquadMap to your Home Screen first/)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('waits for the app’s worker on a first visit, while it is still starting', async () => {
    browser.worker = false;
    let start: (value: unknown) => void = () => {};
    Object.defineProperty(navigator.serviceWorker, 'ready', {
      configurable: true,
      value: new Promise((resolve) => {
        start = resolve;
      }),
    });
    renderSwitches();

    expect(await screen.findByText('Checking this device…')).toBeInTheDocument();
    start({ active: {}, pushManager });

    expect(await screen.findByRole('switch', { name: 'Notifications on this device' })).toBeInTheDocument();
  });

  it('where the browser has no push, says so', async () => {
    browser.worker = false;
    renderSwitches();

    expect(
      await screen.findByText('This browser can’t show notifications from SquadMap.'),
    ).toBeInTheDocument();
  });
});

describe('Keeping the server up to date', () => {
  it('sends the device again when the app opens with notifications on', async () => {
    browser.permission = 'granted';
    browser.current = subscription('https://fcm.googleapis.com/fcm/send/old');

    await syncPush();

    expect(calls()).toContain('POST /me/push/subscribe');
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('subscribes again when the server key has changed', async () => {
    browser.permission = 'granted';
    const old = subscription('https://fcm.googleapis.com/fcm/send/old', OLD_KEY);
    browser.current = old;

    await syncPush();

    expect(old.unsubscribe).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalled();
    expect(calls()).toContain('POST /me/push/subscribe');
  });

  it('does nothing when notifications are off', async () => {
    await syncPush();
    await checkPush();

    expect(calls()).toEqual([]);
  });
});

describe('Signing out', () => {
  it('turns notifications off on this device first', async () => {
    listenForSignOut();
    browser.permission = 'granted';
    const current = subscription('https://fcm.googleapis.com/fcm/send/old');
    browser.current = current;

    await signOut();

    expect(calls()).toEqual(['POST /me/push/unsubscribe', 'POST /auth/logout']);
    expect(current.unsubscribe).toHaveBeenCalled();
    expect(useSession.getState().status).toBe('signedOut');
  });
});

describe('The notification', () => {
  const message = {
    alertId: 'a1',
    tripId: 'trip-1',
    tripName: 'Saturday at Phoenix',
    actorName: 'Aman',
  };

  it('is worded like the inbox', () => {
    expect(pushNotification({ ...message, kind: 'member_joined' })).toEqual({
      title: 'Aman joined your trip',
      body: 'Saturday at Phoenix',
      url: '/trip/trip-1/invite',
      tag: 'a1',
    });
    expect(pushNotification({ ...message, kind: 'ending_soon', actorName: null })).toEqual({
      title: 'Sharing ends soon',
      body: 'Saturday at Phoenix · Extend or end the trip',
      url: '/trip/trip-1/invite',
      tag: 'ending_soon:trip-1',
    });
    expect(pushNotification({ ...message, kind: 'trip_ended', actorName: null })).toMatchObject({
      title: 'Saturday at Phoenix ended',
      body: 'Location sharing has stopped',
      url: '/me/history',
    });
  });

  it('ignores messages it does not understand', () => {
    expect(pushNotification(null)).toBeNull();
    expect(pushNotification('hello')).toBeNull();
    expect(pushNotification({ ...message, kind: 'arrived' })).toBeNull();
    expect(pushNotification({ kind: 'trip_ended' })).toBeNull();
  });
});

describe('Tapping a notification', () => {
  function Where() {
    return <p data-testid="where">{useLocation().pathname}</p>;
  }

  function tap(path: unknown) {
    act(() => {
      navigator.serviceWorker.dispatchEvent(
        new MessageEvent('message', { data: { type: 'OPEN_PATH', path } }),
      );
    });
  }

  it('moves the open app to that screen', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <NotificationTaps />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );

    tap('/me/history');
    expect(screen.getByTestId('where')).toHaveTextContent('/me/history');

    tap('https://elsewhere.example/');
    tap('//elsewhere.example/');
    expect(screen.getByTestId('where')).toHaveTextContent('/me/history');
  });
});
