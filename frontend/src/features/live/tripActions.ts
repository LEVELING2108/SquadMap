import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import { tripKeys } from '../trip/tripQueries';
import type { Trip } from '../trip/types';

/** How much longer the host can share in one go: 30 minutes, 1 hour or 2 hours. */
export const EXTEND_OPTIONS = [30, 60, 120] as const;
export type ExtendMinutes = (typeof EXTEND_OPTIONS)[number];

/** A trip shares for 12 hours at most, counting every extension. */
const MAX_TRIP_MINUTES = 12 * 60;

/** The warning comes this long before sharing ends. */
export const WARN_BEFORE_MS = 10 * 60_000;

/** How many more minutes this trip may add before it reaches 12 hours. */
export function minutesLeftToAdd(trip: Pick<Trip, 'startsAt' | 'expiresAt'>): number {
  const length = Math.round((Date.parse(trip.expiresAt) - Date.parse(trip.startsAt)) / 60_000);
  return Math.max(0, MAX_TRIP_MINUTES - length);
}

/** "+30 min", "+1 h", "+2 h". */
export function extendLabel(minutes: number): string {
  return minutes < 60 ? `+${minutes} min` : `+${minutes / 60} h`;
}

/** "30 minutes", "1 hour", "2 hours", "1 hour 30 minutes": an amount of time in words. */
export function extendWords(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourWords = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const minuteWords = `${rest} ${rest === 1 ? 'minute' : 'minutes'}`;
  if (hours === 0) return minuteWords;
  return rest === 0 ? hourWords : `${hourWords} ${minuteWords}`;
}

/** The host shares for longer; everyone else hears it on the live connection. */
export function useExtendTrip(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (minutes: ExtendMinutes) =>
      api<Trip>(`/trips/${encodeURIComponent(tripId)}/extend`, { method: 'POST', body: { minutes } }),
    onSuccess: (trip) => queryClient.setQueryData(tripKeys.one(tripId), trip),
  });
}

/** The host ends the trip for everyone: sharing stops and the invite link stops working. */
export function useEndTrip(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<Trip>(`/trips/${encodeURIComponent(tripId)}/end`, { method: 'POST' }),
    onSuccess: (trip) => queryClient.setQueryData(tripKeys.one(tripId), trip),
  });
}
