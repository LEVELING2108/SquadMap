import { formatClock } from '../../lib/time';
import { names } from '../live/liveFormat';
import type { ChatMessage } from './chatTypes';

/** The server's limit on a message's length. */
export const MAX_MESSAGE = 280;

/** One tap sends these. */
export const QUICK_REPLIES = ['I’m here', 'Running late', 'Wait for me'];

/** A pause longer than this between two messages gets a new time label above the second. */
const NEW_GROUP_AFTER_MS = 15 * 60_000;

function dayStart(time: number): number {
  const day = new Date(time);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/** Whether a time label goes above this message: the first one, after a long pause, or on a new day. */
export function startsGroup(previous: ChatMessage | undefined, message: ChatMessage): boolean {
  if (!previous) return true;
  const before = Date.parse(previous.sentAt);
  const at = Date.parse(message.sentAt);
  return at - before > NEW_GROUP_AFTER_MS || dayStart(at) !== dayStart(before);
}

/** "Today 5:42 PM", "Yesterday 9:10 AM" or "Mon 12 Nov, 5:42 PM". */
export function groupLabel(iso: string, now: number, format: '12h' | '24h'): string {
  const at = Date.parse(iso);
  const clock = formatClock(iso, format);
  const days = Math.round((dayStart(now) - dayStart(at)) / 86_400_000);
  if (days === 0) return `Today ${clock}`;
  if (days === 1) return `Yesterday ${clock}`;
  const day = new Date(at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${clock}`;
}

/** "Priya is typing", "Priya and Aman are typing", "3 people are typing". */
export function typingWords(who: string[]): string {
  if (who.length === 0) return '';
  if (who.length > 2) return `${who.length} people are typing`;
  return `${names(who)} ${who.length === 1 ? 'is' : 'are'} typing`;
}
