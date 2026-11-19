import { api } from '../../lib/api/client';
import type { JoinPreview, JoinResponse } from './types';

/** Trip codes use 31 characters that can't be mistaken for each other: no 0, O, 1, I or L. */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LENGTH = 8;

/**
 * Tidies a typed code the way the server does: upper case, without spaces or dashes.
 *
 * @returns the code, or null when it can't be a trip code
 */
export function normalizeCode(typed: string): string | null {
  const code = typed.replace(/[\s-]/g, '').toUpperCase();
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

/**
 * Reads a trip code from a scanned QR: an invite link (".../join/K7QX2P9T") or a bare code.
 * Only the code is taken; the app never opens an address it found in a QR code.
 */
export function codeFromScan(text: string): string | null {
  const trimmed = text.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const match = /^\/join\/([^/]+)\/?$/.exec(url.pathname);
    return match ? normalizeCode(decodeURIComponent(match[1]!)) : null;
  } catch {
    return normalizeCode(trimmed);
  }
}

export const joinKeys = {
  preview: (code: string) => ['join', code] as const,
};

export function fetchPreview(code: string): Promise<JoinPreview> {
  return api<JoinPreview>(`/join/${encodeURIComponent(code)}/preview`);
}

/**
 * Joins with the signed-in account, or as a new guest. A guest pass belongs to one trip, so a guest
 * joining another trip starts over as a new guest and the server replaces their pass.
 */
export function joinTrip(
  code: string,
  request: { displayName?: string; shareLocation: boolean },
  asAccount: boolean,
): Promise<JoinResponse> {
  return api<JoinResponse>(`/join/${encodeURIComponent(code)}`, {
    method: 'POST',
    body: request,
    withToken: asAccount,
  });
}

/** Where to show a trip that has ended, with what is known about it. */
export function expiredPath(code: string, endedAt: unknown): string {
  const params = new URLSearchParams({ code });
  if (typeof endedAt === 'string') params.set('ended', endedAt);
  return `/join/expired?${params.toString()}`;
}
