import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lastClient } from '../../test/fakeStomp';
import { jsonResponse, renderApp, sampleTrip, testUser } from '../../test/renderApp';
import { useSession } from '../auth/session';
import type { LiveMember } from '../live/liveTypes';
import { useLiveStore } from '../live/liveStore';
import type { ChatMessage, MessagePage } from './chatTypes';

const fetchMock = vi.fn<typeof fetch>();
const CHAT = '/topic/trip.trip-1.chat';

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
  color: '#993C1D',
  role: 'member',
  you: false,
  location: { lat: 18.56, lng: 73.91, acc: 10, ts: new Date().toISOString() },
};

function message(id: string, from: LiveMember, text: string, minutesAgo = 1): ChatMessage {
  return {
    id,
    memberId: from.memberId,
    displayName: from.displayName,
    color: from.color,
    text,
    sentAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  };
}

function page(items: ChatMessage[], unread = 0, nextBefore: string | null = null): MessagePage {
  return { items, nextBefore, unread, memberId: 'm-priya' };
}

type Answer = (init: RequestInit | undefined) => Response | Promise<Response>;

function serve(routes: Record<string, Answer> = {}, trip: Partial<typeof sampleTrip> = {}) {
  const all: Record<string, Answer> = {
    'GET /trips/trip-1': () =>
      jsonResponse(200, {
        ...sampleTrip,
        expiresAt: new Date(Date.now() + 3 * 3_600_000).toISOString(),
        ...trip,
      }),
    'GET /trips/trip-1/members': () => jsonResponse(200, [priya, aman]),
    'GET /trips/trip-1/eta': () => jsonResponse(200, []),
    'GET /trips/trip-1/messages?limit=50': () => jsonResponse(200, page([])),
    'POST /trips/trip-1/messages/read': () => new Response(null, { status: 204 }),
    ...routes,
  };
  fetchMock.mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input).replace('/api/v1', '')}`;
    const answer = all[key];
    if (!answer) throw new Error(`Unexpected call: ${key}`);
    return answer(init);
  });
}

const calls = (key: string) =>
  fetchMock.mock.calls.filter(([input, init]) => `${init?.method ?? 'GET'} ${String(input)}` === key);
const bodyOf = (call: [RequestInfo | URL, RequestInit?] | undefined) =>
  JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>;

async function open(path: string) {
  renderApp(path);
  await waitFor(() => expect(lastClient().connected).toBe(true));
  return lastClient();
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  useSession.setState({ status: 'signedIn', user: testUser, guest: null, accessToken: 't' });
  useLiveStore.setState({ tripId: null, positions: {} });
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('Trip chat, on the map', () => {
  it('shows the chat button with how many messages are unread, and counts new ones live', async () => {
    serve({
      'GET /trips/trip-1/messages?limit=50': () =>
        jsonResponse(200, page([message('c2', aman, 'Parking now'), message('c1', aman, 'Almost there')], 2)),
    });
    const client = await open('/trip/trip-1');

    expect(await screen.findByRole('link', { name: 'Trip chat, 2 unread' })).toHaveAttribute(
      'href',
      '/trip/trip-1/chat',
    );

    act(() => client.deliver(CHAT, { type: 'MESSAGE', message: message('c3', aman, 'Here'), at: '' }));
    expect(await screen.findByRole('link', { name: 'Trip chat, 3 unread' })).toBeInTheDocument();

    // Your own messages never count.
    act(() => client.deliver(CHAT, { type: 'MESSAGE', message: message('c4', priya, 'Great'), at: '' }));
    act(() => client.deliver(CHAT, { type: 'MESSAGE', message: message('c3', aman, 'Here'), at: '' }));
    expect(screen.getByRole('link', { name: 'Trip chat, 3 unread' })).toBeInTheDocument();
  });

  it('has no chat button when the host turned chat off', async () => {
    serve({}, { chatEnabled: false });
    await open('/trip/trip-1');

    await screen.findByRole('button', { name: 'Show everyone' });
    expect(screen.queryByRole('link', { name: /Trip chat/ })).not.toBeInTheDocument();
    expect(calls('GET /api/v1/trips/trip-1/messages?limit=50')).toHaveLength(0);
  });

  it('offers Message on a friend’s details', async () => {
    serve();
    await open('/trip/trip-1/friend/m-aman');

    expect(await screen.findByRole('link', { name: 'Message' })).toHaveAttribute('href', '/trip/trip-1/chat');
  });
});

describe('Trip chat', () => {
  it('shows the conversation, oldest first, and marks it read', async () => {
    serve({
      'GET /trips/trip-1/messages?limit=50': () =>
        jsonResponse(
          200,
          page(
            [
              message('c2', priya, 'Save me a seat please'),
              message('c1', aman, 'Almost there, parking now', 2),
            ],
            1,
          ),
        ),
    });
    await open('/trip/trip-1/chat');

    expect(await screen.findByRole('heading', { name: 'Trip chat' })).toBeInTheDocument();
    expect(screen.getByText('2 friends')).toBeInTheDocument();
    const log = await screen.findByRole('log', { name: 'Messages' });
    await within(log).findByText('Save me a seat please');
    expect(log.textContent).toMatch(/Aman: Almost there, parking now.*You: Save me a seat please/);
    expect(within(log).getByText(/^Today /)).toBeInTheDocument();
    await waitFor(() => expect(calls('POST /api/v1/trips/trip-1/messages/read')).toHaveLength(1));
    expect(bodyOf(calls('POST /api/v1/trips/trip-1/messages/read')[0])).toEqual({ lastSeenId: 'c2' });
  });

  it('sends what was written, shows it while sending, and clears the box', async () => {
    let finish: (response: Response) => void = () => {};
    serve({
      'POST /trips/trip-1/messages': () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    });
    await open('/trip/trip-1/chat');
    const box = await screen.findByRole('textbox', { name: 'Message' });

    await userEvent.type(box, '  On my way  ');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(box).toHaveValue('');
    expect(screen.getByText('Sending…')).toBeInTheDocument();
    const sent = bodyOf(calls('POST /api/v1/trips/trip-1/messages')[0]);
    expect(sent.text).toBe('On my way');
    expect(sent.clientId).toMatch(/^[0-9a-f-]{36}$/);

    act(() =>
      finish(
        jsonResponse(201, { ...message('c9', priya, 'On my way', 0), clientId: sent.clientId as string }),
      ),
    );
    await waitFor(() => expect(screen.queryByText('Sending…')).not.toBeInTheDocument());
    expect(screen.getAllByText('On my way')).toHaveLength(1);
  });

  it('sends a quick reply in one tap', async () => {
    serve({
      'POST /trips/trip-1/messages': (init) =>
        jsonResponse(201, { ...message('c9', priya, 'I’m here', 0), ...JSON.parse(String(init?.body)) }),
    });
    await open('/trip/trip-1/chat');

    await userEvent.click(await screen.findByRole('button', { name: 'I’m here' }));

    expect(bodyOf(calls('POST /api/v1/trips/trip-1/messages')[0]).text).toBe('I’m here');
    expect(await within(screen.getByRole('log')).findByText('I’m here')).toBeInTheDocument();
  });

  it('says when a message wasn’t sent and retries it as the same message', async () => {
    let attempts = 0;
    serve({
      'POST /trips/trip-1/messages': (init) => {
        attempts += 1;
        return attempts === 1
          ? jsonResponse(429, { code: 'RATE_LIMITED', detail: 'Slow down.', retryAfter: 20 })
          : jsonResponse(201, { ...message('c9', priya, 'Hello', 0), ...JSON.parse(String(init?.body)) });
      },
    });
    await open('/trip/trip-1/chat');
    await userEvent.type(await screen.findByRole('textbox', { name: 'Message' }), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Not sent')).toBeInTheDocument();
    expect(screen.getByText('Too many attempts. Try again in 20 seconds.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.queryByText('Not sent')).not.toBeInTheDocument());
    const [first, second] = calls('POST /api/v1/trips/trip-1/messages');
    expect(bodyOf(second).clientId).toBe(bodyOf(first).clientId);
  });

  it('tells the others while writing, at most every 2 seconds', async () => {
    serve();
    const client = await open('/trip/trip-1/chat');

    await userEvent.type(await screen.findByRole('textbox', { name: 'Message' }), 'Coming');

    const typing = client.published.filter((sent) => sent.destination === '/app/trip.trip-1.typing');
    expect(typing).toHaveLength(1);
  });

  it('shows who is typing until their message arrives', async () => {
    serve();
    const client = await open('/trip/trip-1/chat');
    await screen.findByRole('log');

    act(() => client.deliver(CHAT, { type: 'TYPING', memberId: 'm-aman', at: '' }));
    expect(await screen.findByText('Aman is typing')).toBeInTheDocument();

    act(() => client.deliver(CHAT, { type: 'MESSAGE', message: message('c5', aman, 'Here!', 0), at: '' }));
    await waitFor(() => expect(screen.queryByText('Aman is typing')).not.toBeInTheDocument());
    expect(within(screen.getByRole('log')).getByText('Here!')).toBeInTheDocument();
  });

  it('loads earlier messages on request', async () => {
    serve({
      'GET /trips/trip-1/messages?limit=50': () =>
        jsonResponse(200, page([message('c2', aman, 'Newer')], 0, 'c2')),
      'GET /trips/trip-1/messages?limit=50&before=c2': () =>
        jsonResponse(200, page([message('c1', aman, 'Older', 30)])),
    });
    await open('/trip/trip-1/chat');

    await userEvent.click(await screen.findByRole('button', { name: 'Show earlier messages' }));

    const log = screen.getByRole('log');
    await within(log).findByText('Older');
    expect(log.textContent).toMatch(/Older.*Newer/);
    expect(screen.queryByRole('button', { name: 'Show earlier messages' })).not.toBeInTheDocument();
  });

  it('can be read but not written after the trip ends', async () => {
    serve(
      {
        'GET /trips/trip-1/messages?limit=50': () =>
          jsonResponse(200, page([message('c1', aman, 'Reached')])),
      },
      { status: 'ended' },
    );
    renderApp('/trip/trip-1/chat');

    expect(await screen.findByText('Reached')).toBeInTheDocument();
    expect(
      screen.getByText('This trip has ended. You can read the chat, but not send messages.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument();
  });

  it('says so when the host turned chat off', async () => {
    serve({}, { chatEnabled: false });
    await open('/trip/trip-1/chat');

    expect(await screen.findByRole('heading', { name: 'Chat is off for this trip' })).toBeInTheDocument();
    const notice = screen.getByRole('region', { name: 'Chat is off for this trip' });
    expect(within(notice).getByRole('link', { name: 'Back to the map' })).toHaveAttribute(
      'href',
      '/trip/trip-1',
    );
  });
});
