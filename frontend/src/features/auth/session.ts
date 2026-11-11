import { create } from 'zustand';
import { API_BASE } from '../../lib/api/config';
import type { AuthResponse, User } from './types';

/**
 * Who is signed in. The access token lives only in memory: it is never written to
 * localStorage or a readable cookie, so a script injected into the page cannot steal it
 * from storage. After a reload the session is restored from the HttpOnly refresh cookie.
 */
export type SessionStatus = 'unknown' | 'signedIn' | 'signedOut';

type SessionState = {
  status: SessionStatus;
  user: User | null;
  accessToken: string | null;
};

export const useSession = create<SessionState>(() => ({ status: 'unknown', user: null, accessToken: null }));

export function setSignedIn(response: AuthResponse): void {
  useSession.setState({ status: 'signedIn', user: response.user, accessToken: response.accessToken });
}

export function setSignedOut(): void {
  useSession.setState({ status: 'signedOut', user: null, accessToken: null });
}

export function getAccessToken(): string | null {
  return useSession.getState().accessToken;
}

const REFRESH_LOCK = 'squadmap-session-refresh';
let inFlight: Promise<boolean> | null = null;

/**
 * Swaps the refresh cookie for a new access token.
 *
 * Every refresh replaces the cookie, and presenting a replaced cookie ends the session. So only
 * one refresh may run at a time: within this tab the running one is shared, and across tabs the
 * browser's Web Locks queue them. The next tab in line then sends the already-replaced cookie.
 *
 * @returns whether the person is signed in afterwards
 */
export function refreshSession(): Promise<boolean> {
  if (!inFlight) {
    inFlight = withRefreshLock(requestRefresh).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function requestRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (response.ok) {
      setSignedIn((await response.json()) as AuthResponse);
      return true;
    }
    if (response.status === 401) {
      setSignedOut();
      return false;
    }
  } catch {
    // Network failure: handled below.
  }
  // Rate limited, server error or offline: the session may still be fine, so a signed-in person
  // stays signed in. On first load there is nothing to keep, so treat it as signed out.
  if (useSession.getState().status === 'unknown') setSignedOut();
  return useSession.getState().status === 'signedIn';
}

function withRefreshLock(task: () => Promise<boolean>): Promise<boolean> {
  // Older browsers without Web Locks fall back to coordinating within the tab only.
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(REFRESH_LOCK, task);
  }
  return task();
}

/** On app start: restore the session from the refresh cookie, if there is one. */
export function restoreSession(): Promise<boolean> {
  return refreshSession();
}

/** Ends this device's session. Always signs out locally, even if the server can't be reached. */
export async function signOut(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch {
    // The cookie is HttpOnly, so the server must clear it; if offline it expires on its own.
  } finally {
    setSignedOut();
  }
}
