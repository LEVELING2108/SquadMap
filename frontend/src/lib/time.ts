/** "9:30 PM" or "21:30": a clock time in the person's chosen format. */
export function formatClock(iso: string, format: '12h' | '24h'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', hour12: format === '12h' });
}
