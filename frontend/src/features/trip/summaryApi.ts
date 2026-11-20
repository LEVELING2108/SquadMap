import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import { formatDistance } from '../../lib/map/geo';
import { tripKeys } from './tripQueries';
import type { Destination, TripStatus } from './types';

/** A trip in numbers, as you saw it (GET /trips/:id/summary). Totals only, never places. */
export type TripSummary = {
  id: string;
  name: string;
  destination: Destination | null;
  status: TripStatus;
  role: 'host' | 'member';
  startsAt: string;
  /** When sharing stopped; null while the trip runs. */
  endedAt: string | null;
  /** From the start until it ended, or until now while it runs. */
  durationSeconds: number;
  /** Everyone else who was on the trip at any point. */
  friendCount: number;
  /** How far you moved while sharing, in metres; null if you never shared. */
  distanceM: number | null;
  arrivedAt: string | null;
};

export const summaryKey = (tripId: string) => [...tripKeys.one(tripId), 'summary'] as const;

export function useTripSummary(tripId: string, enabled = true) {
  return useQuery({
    queryKey: summaryKey(tripId),
    queryFn: () => api<TripSummary>(`/trips/${encodeURIComponent(tripId)}/summary`),
    enabled: enabled && tripId !== '',
  });
}

/** "8.1 km", "0 m", or a dash for someone who never shared. */
export function distanceText(metres: number | null, unit: 'km' | 'mi'): string {
  if (metres === null) return '–';
  if (metres === 0) return unit === 'mi' ? '0 ft' : '0 m';
  return formatDistance(metres, unit) ?? '–';
}

/** "19 min", "2 h 5 min": how long a trip lasted. Under a minute shows as "1 min". */
export function lengthText(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
