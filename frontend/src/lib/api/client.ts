import { getAccessToken, refreshSession } from '../../features/auth/session';
import { ApiError } from './ApiError';
import { API_BASE } from './config';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type RequestOptions = {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
  /** False sends the call without the access token, as someone with no session. */
  withToken?: boolean;
};

/**
 * Calls the API and returns the parsed JSON body (undefined for 204/202 with no body).
 * Sends the access token when there is one. If the server says the token is no longer valid,
 * refreshes the session once and repeats the call.
 *
 * @throws ApiError for any non-2xx answer, or with code NETWORK when the server can't be reached
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const withToken = options.withToken ?? true;
  let response = await send(path, options, withToken ? getAccessToken() : null);

  if (response.status === 401 && withToken && getAccessToken() !== null) {
    const failure = await ApiError.fromResponse(response.clone());
    // Only an expired or rejected token is worth a refresh; a wrong password is not.
    if (failure.code === 'UNAUTHENTICATED' && (await refreshSession())) {
      response = await send(path, options, getAccessToken());
    }
  }

  if (!response.ok) throw await ApiError.fromResponse(response);
  if (response.status === 204 || response.headers.get('Content-Length') === '0') return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    return await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      // The refresh cookie must travel to the auth routes, including when the API is on another origin.
      credentials: 'include',
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw ApiError.network();
  }
}
