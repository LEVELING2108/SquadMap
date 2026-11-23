import { describe, expect, it } from 'vitest';
import { pathOnly, scrubEvent, startErrorReporting } from './errorReporting';

describe('Error reports', () => {
  it('keep only the page path, never a query, cookie, header, body or user', () => {
    const event = scrubEvent({
      message: 'Boom',
      user: { id: 'u1', email: 'priya@example.com' },
      extra: { lat: 18.56 },
      request: {
        url: 'https://app.example.com/trip/abc?token=secret#x',
        query_string: 'token=secret',
        cookies: { sm_refresh: 'secret' },
        headers: { Authorization: 'Bearer secret' },
        data: { lat: 18.56, lng: 73.91 },
      },
    });

    expect(event).toEqual({
      message: 'Boom',
      user: undefined,
      extra: undefined,
      request: { url: '/trip/abc' },
    });
    expect(JSON.stringify(event)).not.toMatch(/secret|18\.56|priya/);
  });

  it('turn a page address into its path', () => {
    // Map and route addresses never get here: network calls aren't recorded at all.
    expect(pathOnly('https://app.example.com/trip/abc/chat?from=push')).toBe('/trip/abc/chat');
    expect(pathOnly('/me/alerts?x=1')).toBe('/me/alerts');
    expect(pathOnly(undefined)).toBeUndefined();
  });

  it('send nothing when the build has no Sentry address', () => {
    expect(import.meta.env.VITE_SENTRY_DSN).toBeUndefined();
    expect(() => startErrorReporting()).not.toThrow();
  });
});
