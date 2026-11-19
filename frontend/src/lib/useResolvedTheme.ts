import { useSyncExternalStore } from 'react';
import type { ResolvedTheme } from './theme';

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

function read(): ResolvedTheme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** The theme actually showing, light or dark, following the attribute on <html>. */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, read, () => 'light');
}
