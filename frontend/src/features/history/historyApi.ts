import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import type { Destination, TripStatus } from '../trip/types';

/** One trip in the history (GET /me/trips). */
export type HistoryTrip = {
  id: string;
  name: string;
  destination: Destination | null;
  startsAt: string;
  /** When sharing is set to stop. */
  expiresAt: string;
  /** When sharing stopped; null while the trip runs. */
  endedAt: string | null;
  status: TripStatus;
  role: 'host' | 'member';
  /** Everyone else who was on the trip at any point. */
  friendCount: number;
  /** Up to 5 of their names. */
  friends: string[];
  /** How far you moved while sharing, in metres, once the trip is over; null if you never shared. */
  distanceM: number | null;
};

type HistoryPage = { items: HistoryTrip[]; nextBefore: string | null };

export const historyKey = ['trips', 'history'] as const;

/** Trip history, newest first, loaded a page at a time. */
export function useTripHistory() {
  return useInfiniteQuery({
    queryKey: historyKey,
    queryFn: ({ pageParam }) =>
      api<HistoryPage>(`/me/trips?limit=20${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
  });
}

/** "Today", "Yesterday", "Nov 12", or "Oct 12, 2025" for another year. */
export function whenLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((dayStart(now) - dayStart(date)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

/** "Just you", "With Aman", "4 friends". */
export function friendsLabel(trip: Pick<HistoryTrip, 'friendCount' | 'friends'>): string {
  if (trip.friendCount === 0) return 'Just you';
  if (trip.friendCount === 1 && trip.friends[0]) return `With ${trip.friends[0]}`;
  return `${trip.friendCount} friends`;
}

/** The friend who appears on the most trips (at least two), for the "With ..." filter. */
export function topFriend(trips: HistoryTrip[]): string | null {
  const counts = new Map<string, number>();
  for (const trip of trips) {
    for (const name of new Set(trip.friends)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [name, count] of counts) {
    if (count >= 2 && count > (best ? counts.get(best)! : 0)) best = name;
  }
  return best;
}

export function isThisMonth(iso: string, now = new Date()): boolean {
  const date = new Date(iso);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}
