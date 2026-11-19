const REDUCE_MOTION_KEY = 'squadmap.reduceMotion';

export function markReducedMotion(on: boolean): void {
  const root = document.documentElement;
  if (on) root.setAttribute('data-reduce-motion', '');
  else root.removeAttribute('data-reduce-motion');
}

/**
 * Applies the "Reduce animations" choice remembered on this device, before the page draws. The account's
 * settings arrive a moment later; without this, animations would play until they did.
 */
export function applyRememberedPreferences(): void {
  try {
    markReducedMotion(window.localStorage.getItem(REDUCE_MOTION_KEY) === '1');
  } catch {
    // Storage blocked: the account's setting still applies once it arrives.
  }
}

/** Remembers the choice on this device for the next visit. It holds nothing personal. */
export function rememberReducedMotion(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(REDUCE_MOTION_KEY, '1');
    else window.localStorage.removeItem(REDUCE_MOTION_KEY);
  } catch {
    // Storage blocked: nothing to remember.
  }
}
