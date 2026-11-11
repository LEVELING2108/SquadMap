/**
 * Theme handling. The app follows the system setting until the person picks one;
 * the pick is remembered on this device. The resolved theme is written to
 * data-theme on <html>, which is what the CSS reads.
 *
 * public/theme-init.js applies the same rules before the app loads.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'squadmap.theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const listeners = new Set<() => void>();

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

export function getThemeChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage can be blocked (private mode); treat as "no choice made".
  }
  return 'system';
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return choice;
}

function apply(choice: ThemeChoice): void {
  document.documentElement.setAttribute('data-theme', resolveTheme(choice));
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // The theme still applies for this visit even if it cannot be saved.
  }
  apply(choice);
  listeners.forEach((notify) => notify());
}

/** Subscribe to theme changes: an explicit pick, or the system setting while on "system". */
export function subscribeToTheme(onChange: () => void): () => void {
  listeners.add(onChange);

  const media = typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
  const onSystemChange = () => {
    if (getThemeChoice() === 'system') {
      apply('system');
      onChange();
    }
  };
  media?.addEventListener('change', onSystemChange);

  return () => {
    listeners.delete(onChange);
    media?.removeEventListener('change', onSystemChange);
  };
}

/** Call once at startup so the attribute is correct even if theme-init.js did not run. */
export function initTheme(): void {
  apply(getThemeChoice());
}
