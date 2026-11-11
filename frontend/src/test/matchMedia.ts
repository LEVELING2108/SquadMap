/**
 * jsdom has no matchMedia. This stand-in lets a test set the system color scheme
 * and notifies listeners the way a browser does when the setting changes.
 */
type Listener = (event: MediaQueryListEvent) => void;

let prefersDark = false;
const listeners = new Set<Listener>();

export function setSystemPrefersDark(value: boolean): void {
  const changed = prefersDark !== value;
  prefersDark = value;
  if (changed) {
    listeners.forEach((listener) => listener({ matches: value } as MediaQueryListEvent));
  }
}

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (query: string) => ({
    media: query,
    get matches() {
      return query.includes('prefers-color-scheme: dark') ? prefersDark : false;
    },
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  }),
});
