import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import type { Trip } from './types';

export const tripKeys = {
  all: ['trips'] as const,
  active: () => [...tripKeys.all, 'active'] as const,
  one: (id: string) => [...tripKeys.all, id] as const,
};

export function useTrip(tripId: string) {
  return useQuery({
    queryKey: tripKeys.one(tripId),
    queryFn: () => api<Trip>(`/trips/${encodeURIComponent(tripId)}`),
  });
}

export function useActiveTrips(enabled: boolean) {
  return useQuery({
    queryKey: tripKeys.active(),
    queryFn: () => api<Trip[]>('/trips?status=active'),
    enabled,
  });
}

/** "4 h" or "90 min": how long sharing lasts in total. */
export function shareLength(trip: Pick<Trip, 'startsAt' | 'expiresAt'>): string {
  const minutes = Math.round((Date.parse(trip.expiresAt) - Date.parse(trip.startsAt)) / 60_000);
  return minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;
}

/** The short place name for the ticket: "Phoenix Marketcity, Viman Nagar" becomes "Phoenix Marketcity". */
export function shortPlace(name: string): string {
  return name.split(',')[0]!.trim();
}
