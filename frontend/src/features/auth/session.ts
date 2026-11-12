import { create } from 'zustand';
import { API_BASE } from '../../lib/api/config';
import type { JoinResponse } from '../invite/types';
import type { AuthResponse, User } from './types';

/**
 * Who is using the app. The access token lives only in memory: it is never written to
 * localStorage or a readable cookie, so a script injected into the page cannot steal it
 * from storage. After a reload the session is restored from an HttpOnly cookie: the refresh
 * cookie for an account, the guest cookie for someone who joined a trip without one.
 */
export type SessionStatus = 'unknown' | 'signedIn' | 'guest' | 'signedOut';

/** Someone on one trip without an account. Their pass works for that trip only, until it ends. */
export type Guest = {
  tripId: string;
  memberId: string;
  displayName: string;
  color: string;
};

type SessionState = {
  status: SessionStatus;
  user: User | null;
  guest: Guest | null;
  accessToken: string | null;
  /** True when this device held a guest pass whose trip is now over, so the guest can be told why. */
  guestEnded?: boolean;
};

export const useSession = create<SessionState>(() => ({
  status: 'unknown',
  user: null,
  guest: null,
  accessToken: null,
}));

/**
 * Remembers that this browser holds a guest pass, so only those visitors try to restore one on start.
 * It holds no secret: the pass itself stays in the HttpOnly cookie.
 */
const GUEST_HINT = 'squadmap.guest';

function rememberGuest(present: boolean): void {
  try {
    if (present) window.localStorage.setItem(GUEST_HINT, '1');
    else window.localStorage.removeItem(GUEST_HINT);
  } catch {
    // Storage blocked: the guest is simply not picked up after a reload.
  }
}

function hasGuestHint(): boolean {
  try {
    return window.localStorage.getItem(GUEST_HINT) === '1';
  } catch {
    return false;
  }
}

export function setSignedIn(response: AuthResponse): void {
  // An account replaces a guest pass on this device.
  rememberGuest(false);
  useSession.setState({
    status: 'signedIn',
    user: response.user,
    guest: null,
    accessToken: response.accessToken,
  });
}

/** After joining without an account, or picking that guest session back up. */
export function setGuest(response: JoinResponse): void {
  if (!response.accessToken) return;
  rememberGuest(true);
  useSession.setState({
    status: 'guest',
    user: null,
    guest: {
      tripId: response.tripId,
      memberId: response.memberId,
      displayName: response.displayName,
      color: response.color,
    },
    accessToken: response.accessToken,
  });
}

export function setSignedOut(): void {
  useSession.setState({ status: 'signedOut', user: null, guest: null, accessToken: null, guestEnded: false });
}

export function getAccessToken(): string | null {
  return useSession.getState().accessToken;
}

const REFRESH_LOCK = 'squadmap-session-refresh';
let inFlight: Promise<boolean> | null = null;

/**
 * Gets a new access token: from the refresh cookie for an account, or from the guest cookie for a
 * guest (for example after the host extended the trip).
 *
 * Every account refresh replaces the cookie, and presenting a replaced cookie ends the session. So only
 * one refresh may run at a time: within this tab the running one is shared, and across tabs the
 * browser's Web Locks queue them. The next tab in line then sends the already-replaced cookie.
 *
 * @returns whether the person is signed in (with an account or as a guest) afterwards
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
  const status = useSession.getState().status;
  if (status === 'guest') return requestGuestSession();

  const outcome = await post('/auth/refresh');
  if (outcome.kind === 'ok') {
    setSignedIn((await outcome.response.json()) as AuthResponse);
    return true;
  }
  if (outcome.kind === 'ended') {
    // On first load, someone without an account may still hold a guest pass.
    if (status === 'unknown' && hasGuestHint()) return requestGuestSession();
    setSignedOut();
    return false;
  }
  return keepOnFailure();
}

async function requestGuestSession(): Promise<boolean> {
  const outcome = await post('/guest/session');
  if (outcome.kind === 'ok') {
    setGuest((await outcome.response.json()) as JoinResponse);
    return true;
  }
  if (outcome.kind === 'ended') {
    rememberGuest(false);
    setSignedOut();
    useSession.setState({ guestEnded: true });
    return false;
  }
  return keepOnFailure();
}

type Outcome = { kind: 'ok'; response: Response } | { kind: 'ended' } | { kind: 'failed' };

async function post(path: string): Promise<Outcome> {
  try {
    const response = await fetch(`${API_BASE}${path}`, { method: 'POST', credentials: 'include' });
    if (response.ok) return { kind: 'ok', response };
    if (response.status === 401) return { kind: 'ended' };
  } catch {
    // Network failure: handled by the caller.
  }
  return { kind: 'failed' };
}

/**
 * Rate limited, server error or offline: the session may still be fine, so a signed-in person or
 * guest stays signed in. On first load there is nothing to keep, so treat it as signed out.
 */
function keepOnFailure(): boolean {
  const status = useSession.getState().status;
  if (status === 'unknown') setSignedOut();
  return status === 'signedIn' || status === 'guest';
}

function withRefreshLock(task: () => Promise<boolean>): Promise<boolean> {
  // Older browsers without Web Locks fall back to coordinating within the tab only.
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(REFRESH_LOCK, task);
  }
  return task();
}

/** On app start: restore the session from the refresh cookie, or the guest cookie, if there is one. */
export function restoreSession(): Promise<boolean> {
  return refreshSession();
}

/** Ends this device's session. Always signs out locally, even if the server can't be reached. */
export async function signOut(): Promise<void> {
  const wasGuest = useSession.getState().status === 'guest';
  try {
    await fetch(`${API_BASE}${wasGuest ? '/guest/logout' : '/auth/logout'}`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // The cookie is HttpOnly, so the server must clear it; if offline it expires on its own.
  } finally {
    if (wasGuest) rememberGuest(false);
    setSignedOut();
  }
}
