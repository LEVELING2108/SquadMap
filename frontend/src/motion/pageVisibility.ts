/**
 * Marks <html> while the tab is hidden, so CSS can pause the ambient loops
 * (clouds, plane, shine) instead of running them in the background.
 */
export function trackPageVisibility(): () => void {
  const update = () => {
    document.documentElement.toggleAttribute('data-page-hidden', document.visibilityState === 'hidden');
  };
  update();
  document.addEventListener('visibilitychange', update);
  return () => document.removeEventListener('visibilitychange', update);
}
