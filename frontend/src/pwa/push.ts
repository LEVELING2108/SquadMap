import { create } from 'zustand';
import { api } from '../lib/api/client';
import { onSignOut, useSession } from '../features/auth/session';
import { isAppleMobile, useInstall } from './installPrompt';

/**
 * Whether this device can get push notifications:
 * - `ready`: yes, they can be turned on here
 * - `install`: iPhone and iPad allow them only in the app added to the home screen
 * - `blocked`: the person said no in the browser; only the browser's site settings can undo that
 * - `unavailable`: this browser has no push, or the app runs without its offline worker (development)
 * - `checking`: not known yet
 */
export type PushSupport = 'checking' | 'ready' | 'install' | 'blocked' | 'unavailable';

type PushState = {
  support: PushSupport;
  /** Whether this device is getting notifications now. */
  on: boolean;
  /** True while turning them on or off. */
  busy: boolean;
  /** Set when the last attempt failed, in words for the person. */
  problem: string | null;
};

export const usePush = create<PushState>(() => ({
  support: 'checking',
  on: false,
  busy: false,
  problem: null,
}));

function browserHasPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** How long to wait for the app's service worker to start, on a first visit or right after an update. */
const WORKER_WAIT_MS = 5_000;

/**
 * The app's service worker, once it runs. On a first visit it is still installing when a screen asks, so
 * this waits a little for it; in development there is none, and after the wait the answer is no.
 */
async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!browserHasPush()) return undefined;
  const found = await navigator.serviceWorker.getRegistration();
  if (found?.active) return found;
  const timeout = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), WORKER_WAIT_MS));
  const ready = await Promise.race([navigator.serviceWorker.ready, timeout]);
  return ready?.active ? ready : undefined;
}

function base64UrlToBytes(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sameKey(subscription: PushSubscription, key: Uint8Array): boolean {
  const used = subscription.options.applicationServerKey;
  if (!used) return false;
  const bytes = new Uint8Array(used);
  return bytes.length === key.length && bytes.every((byte, i) => byte === key[i]);
}

async function serverKey(): Promise<Uint8Array<ArrayBuffer>> {
  const { publicKey } = await api<{ publicKey: string }>('/me/push/key');
  return base64UrlToBytes(publicKey);
}

/** Tells the server about this device. A subscription made with an old server key is replaced first. */
async function register(found: ServiceWorkerRegistration): Promise<void> {
  const key = await serverKey();
  let subscription = await found.pushManager.getSubscription();
  if (subscription && !sameKey(subscription, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await found.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await api<void>('/me/push/subscribe', { method: 'POST', body: subscription.toJSON() });
}

/** Works out what this device allows, and whether it is getting notifications. */
export async function checkPush(): Promise<void> {
  const found = await registration();
  if (!found) {
    const installedApple = isAppleMobile() && !useInstall.getState().installed;
    usePush.setState({ support: installedApple ? 'install' : 'unavailable', on: false });
    return;
  }
  if (Notification.permission === 'denied') {
    usePush.setState({ support: 'blocked', on: false });
    return;
  }
  const subscription = await found.pushManager.getSubscription();
  usePush.setState({
    support: 'ready',
    on: Notification.permission === 'granted' && subscription !== null,
  });
}

/**
 * When a signed-in account opens the app: if this device has notifications on, makes sure the server
 * still has it (the browser may have renewed it, or the server's key changed).
 */
export async function syncPush(): Promise<void> {
  try {
    await checkPush();
    const found = await registration();
    if (!found || !usePush.getState().on) return;
    await register(found);
  } catch {
    // Tried again on the next start.
  }
}

/** Asks the browser for permission if needed, then starts notifications on this device. */
export async function turnPushOn(): Promise<void> {
  const found = await registration();
  if (!found) return;
  usePush.setState({ busy: true, problem: null });
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      usePush.setState({ support: permission === 'denied' ? 'blocked' : 'ready', on: false });
      return;
    }
    await register(found);
    usePush.setState({ on: true });
  } catch {
    usePush.setState({
      problem: 'Notifications couldn’t be turned on. Check your connection and try again.',
    });
  } finally {
    usePush.setState({ busy: false });
  }
}

/** Stops notifications on this device, here and on the server. */
export async function turnPushOff(): Promise<void> {
  usePush.setState({ busy: true, problem: null });
  try {
    await forgetThisDevice();
    usePush.setState({ on: false });
  } catch {
    usePush.setState({
      problem: 'Notifications couldn’t be turned off. Check your connection and try again.',
    });
  } finally {
    usePush.setState({ busy: false });
  }
}

async function forgetThisDevice(): Promise<void> {
  const found = await registration();
  const subscription = await found?.pushManager.getSubscription();
  if (!subscription) return;
  await api<void>('/me/push/unsubscribe', { method: 'POST', body: { endpoint: subscription.endpoint } });
  await subscription.unsubscribe();
}

/**
 * Call once at startup: signing out turns notifications off on this device, so a shared phone doesn't
 * keep showing someone else's trips. If the server can't be told, the browser still drops the
 * subscription, and the server forgets it the next time it tries to send.
 */
export function listenForSignOut(): void {
  onSignOut(async () => {
    try {
      await forgetThisDevice();
    } catch {
      const found = await registration();
      await (await found?.pushManager.getSubscription())?.unsubscribe();
    }
    usePush.setState({ on: false });
  });
}

/** Call once at startup: each time an account signs in on this device, checks its notifications. */
export function syncPushOnSignIn(): void {
  useSession.subscribe((state, before) => {
    if (state.status === 'signedIn' && before.status !== 'signedIn') void syncPush();
  });
}
