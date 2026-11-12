import { describe, expect, it } from 'vitest';
import { codeFromScan, expiredPath, normalizeCode } from './joinApi';
import { timeAgo } from './timeAgo';

describe('normalizeCode', () => {
  it('tidies a typed code the way the server does', () => {
    expect(normalizeCode('k7qx 2p9t')).toBe('K7QX2P9T');
    expect(normalizeCode('K7QX-2P9T')).toBe('K7QX2P9T');
  });

  it.each(['K7QX2P9', 'K7QX2P9TT', 'K7QX2P0T', 'K7QXIP9T', 'K7QX2P9!', ''])('rejects %j', (typed) => {
    expect(normalizeCode(typed)).toBeNull();
  });
});

describe('codeFromScan', () => {
  it('takes the code from an invite link', () => {
    expect(codeFromScan('https://squadmap.app/join/K7QX2P9T')).toBe('K7QX2P9T');
    expect(codeFromScan('http://localhost:5480/join/k7qx2p9t/')).toBe('K7QX2P9T');
  });

  it('accepts a bare code', () => {
    expect(codeFromScan(' K7QX2P9T ')).toBe('K7QX2P9T');
  });

  it.each([
    'https://example.com/login',
    'https://example.com/join/K7QX2P9T/consent',
    'javascript:alert(1)//join/K7QX2P9T',
    'WIFI:S:home;T:WPA;P:secret;;',
    'https://example.com/join/NOTACODE',
  ])('ignores %j', (text) => {
    expect(codeFromScan(text)).toBeNull();
  });
});

describe('expiredPath', () => {
  it('carries the code and when the trip ended', () => {
    expect(expiredPath('K7QX2P9T', '2026-11-12T10:00:00Z')).toBe(
      '/join/expired?code=K7QX2P9T&ended=2026-11-12T10%3A00%3A00Z',
    );
    expect(expiredPath('K7QX2P9T', undefined)).toBe('/join/expired?code=K7QX2P9T');
  });
});

describe('timeAgo', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');

  it.each([
    ['2026-11-12T11:59:40Z', 'just now'],
    ['2026-11-12T11:35:00Z', '25 minutes ago'],
    ['2026-11-12T10:00:00Z', '2 hours ago'],
    ['2026-11-11T09:00:00Z', 'yesterday'],
    ['2026-11-08T12:00:00Z', '4 days ago'],
  ])('describes %s as %j', (iso, words) => {
    expect(timeAgo(iso, now)).toBe(words);
  });

  it('gives nothing for a missing time', () => {
    expect(timeAgo('', now)).toBeNull();
  });
});
