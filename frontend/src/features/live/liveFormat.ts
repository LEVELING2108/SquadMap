/** A spot this old is shown dimmed, with how old it is. */
export const STALE_AFTER_MS = 60_000;

/** "3 h left", "45 min left", "1 min left": what remains of the trip, for the top bar. */
export function timeLeft(expiresAt: string, now: number): string {
  const minutes = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 60_000));
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 || hours >= 3 ? `${hours} h left` : `${hours} h ${rest} min left`;
  }
  return `${minutes} min left`;
}

/** "2 min ago" for a spot older than a minute, or null while it is fresh. */
export function staleLabel(ts: string, now: number): string | null {
  const age = now - Date.parse(ts);
  if (Number.isNaN(age) || age < STALE_AFTER_MS) return null;
  const minutes = Math.floor(age / 60_000);
  return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ago`;
}

/** "Aman", "Aman and Priya", "Aman, Priya and 2 more". */
export function names(list: string[]): string {
  if (list.length <= 1) return list[0] ?? '';
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  if (list.length === 3) return `${list[0]}, ${list[1]} and ${list[2]}`;
  return `${list[0]}, ${list[1]} and ${list.length - 2} more`;
}
