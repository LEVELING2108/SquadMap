/** "2 hours ago", "yesterday": how long ago a moment was, in words. */
export function timeAgo(iso: string, now = Date.now()): string | null {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const minutes = Math.round((then - now) / 60_000);
  const words = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(minutes) < 1) return 'just now';
  if (Math.abs(minutes) < 60) return words.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return words.format(hours, 'hour');
  return words.format(Math.round(hours / 24), 'day');
}
