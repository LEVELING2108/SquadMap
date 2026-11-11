import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccessToken, refreshSession, restoreSession, signOut, useSession } from './session';

const signedInBody = {
  accessToken: 'access-1',
  expiresIn: 900,
  user: {
    id: 'u1',
    name: 'Priya',
    email: 'priya@example.com',
    color: '#0F6E56',
    createdAt: '2026-11-11T00:00:00Z',
  },
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  useSession.setState({ status: 'unknown', user: null, accessToken: null });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('session', () => {
  it('restores a session from the refresh cookie', async () => {
    fetchMock.mockResolvedValueOnce(json(200, signedInBody));

    expect(await restoreSession()).toBe(true);

    expect(useSession.getState().status).toBe('signedIn');
    expect(useSession.getState().user?.name).toBe('Priya');
    expect(getAccessToken()).toBe('access-1');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/auth/refresh');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('is signed out when there is no valid cookie', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { code: 'SESSION_EXPIRED' }));

    expect(await restoreSession()).toBe(false);
    expect(useSession.getState().status).toBe('signedOut');
  });

  it('is signed out on first load when the server cannot be reached', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    expect(await restoreSession()).toBe(false);
    expect(useSession.getState().status).toBe('signedOut');
  });

  it('stays signed in when a refresh fails for a reason other than the session', async () => {
    useSession.setState({ status: 'signedIn', user: signedInBody.user, accessToken: 'old' });
    fetchMock.mockResolvedValueOnce(json(429, { code: 'RATE_LIMITED' }));

    expect(await refreshSession()).toBe(true);
    expect(useSession.getState().status).toBe('signedIn');
  });

  it('shares one refresh between callers in the same tab', async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise((r) => (resolve = r)));

    const first = refreshSession();
    const second = refreshSession();
    resolve(json(200, signedInBody));

    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('starts a new refresh once the previous one has finished', async () => {
    fetchMock.mockResolvedValueOnce(json(200, signedInBody));
    fetchMock.mockResolvedValueOnce(json(200, { ...signedInBody, accessToken: 'access-2' }));

    await refreshSession();
    await refreshSession();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getAccessToken()).toBe('access-2');
  });

  it('runs the refresh under a cross-tab lock when the browser has Web Locks', async () => {
    const request = vi.fn((_name: string, task: () => Promise<boolean>) => task());
    vi.stubGlobal('navigator', { locks: { request } });
    fetchMock.mockResolvedValueOnce(json(200, signedInBody));

    await refreshSession();

    expect(request).toHaveBeenCalledWith('squadmap-session-refresh', expect.any(Function));
  });

  it('signs out locally even when the server cannot be reached', async () => {
    useSession.setState({ status: 'signedIn', user: signedInBody.user, accessToken: 'access-1' });
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await signOut();

    expect(useSession.getState()).toMatchObject({ status: 'signedOut', user: null, accessToken: null });
  });
});
