import { api } from '../../lib/api/client';

/** Everything kept about the account (GET /me/export), saved as squadmap-data.json on this device. */
export async function downloadMyData(): Promise<void> {
  const data = await api<unknown>('/me/export');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'squadmap-data.json';
  document.body.append(link);
  link.click();
  link.remove();
  // Long enough for the browser to start saving it.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Removes every trip that is over from the history (POST /me/trips/forget); running trips stay. */
export function forgetPastTrips(): Promise<{ removed: number }> {
  return api<{ removed: number }>('/me/trips/forget', { method: 'POST' });
}

/** Closes the account; its data is removed on the day returned unless the person logs in before then. */
export function deleteAccount(password: string): Promise<{ removeAt: string }> {
  return api<{ removeAt: string }>('/me', { method: 'DELETE', body: { password } });
}

/** "20 December 2026". */
export function longDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
