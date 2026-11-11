import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession } from '../../features/auth/session';
import { ApiError } from './ApiError';
import { api } from './client';

const user = {
  id: 'u1',
  name: 'Priya',
  email: 'priya@example.com',
  color: '#0F6E56',
  createdAt: '2026-11-11T00:00:00Z',
};

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json', ...headers },
  });
}

const fetchMock = vi.fn<typeof fetch>();
const authHeader = (call: number) =>
  (fetchMock.mock.calls[call]![1]!.headers as Record<string, string>).Authorization;

beforeEach(() => {
  useSession.setState({ status: 'signedIn', user, accessToken: 'old-token' });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('sends JSON with the access token and returns the parsed body', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

    const result = await api<{ ok: boolean }>('/me', { method: 'POST', body: { a: 1 } });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/me');
    expect(init).toMatchObject({ method: 'POST', body: '{"a":1}', credentials: 'include' });
    expect(authHeader(0)).toBe('Bearer old-token');
  });

  it('returns undefined for an empty response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    expect(await api('/auth/logout', { method: 'POST' })).toBeUndefined();
  });

  it('refreshes an expired token once and repeats the call', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { code: 'UNAUTHENTICATED', detail: 'Sign in to continue.' }))
      .mockResolvedValueOnce(json(200, { accessToken: 'new-token', expiresIn: 900, user }))
      .mockResolvedValueOnce(json(200, { name: 'Priya' }));

    const result = await api<{ name: string }>('/me');

    expect(result).toEqual({ name: 'Priya' });
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/v1/auth/refresh');
    expect(authHeader(2)).toBe('Bearer new-token');
  });

  it('gives up when the refresh fails, and the person is signed out', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { code: 'UNAUTHENTICATED', detail: 'Sign in to continue.' }))
      .mockResolvedValueOnce(json(401, { code: 'SESSION_EXPIRED' }));

    await expect(api('/me')).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(useSession.getState().status).toBe('signedOut');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not refresh for a wrong password', async () => {
    fetchMock.mockResolvedValueOnce(
      json(401, { code: 'INVALID_CREDENTIALS', detail: 'Email or password is incorrect.' }),
    );

    await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      detail: 'Email or password is incorrect.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads field errors from a validation failure', async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, {
        code: 'VALIDATION_FAILED',
        detail: 'One or more fields are invalid.',
        errors: [
          { field: 'email', message: 'Enter a valid email address.' },
          { field: 'password', message: 'Use between 8 and 128 characters.' },
        ],
      }),
    );

    const error = await api('/auth/signup', { method: 'POST', body: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).fieldErrors).toEqual({
      email: 'Enter a valid email address.',
      password: 'Use between 8 and 128 characters.',
    });
  });

  it('reads how long to wait when rate limited', async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        429,
        { code: 'RATE_LIMITED', detail: 'Too many attempts.', retryAfter: 12 },
        { 'Retry-After': '12' },
      ),
    );

    await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 429,
      retryAfter: 12,
    });
  });

  it('reports a network failure with a readable message', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(api('/me')).rejects.toMatchObject({ status: 0, code: 'NETWORK' });
  });

  it('falls back to a generic error for a non-JSON failure', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('<html>Bad gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }),
    );

    await expect(api('/me')).rejects.toMatchObject({ status: 502, code: 'UNKNOWN' });
  });
});
