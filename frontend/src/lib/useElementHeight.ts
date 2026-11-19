import { useCallback, useEffect, useState } from 'react';

/**
 * Watches the height of whichever element the returned ref is attached to, including one that appears or
 * is swapped later. Used to keep a map's centre and credits clear of a panel covering it.
 */
export function useElementHeight<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [height, setHeight] = useState(0);
  const ref = useCallback((node: T | null) => setElement(node), []);
  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return;
    // The observer reports the size straight away, then on every change.
    const observer = new ResizeObserver(() => setHeight(element.getBoundingClientRect().height));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [ref, element ? height : 0] as const;
}
