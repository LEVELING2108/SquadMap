import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import type { Eta, LiveMember, TravelMode } from './liveTypes';

export const liveKeys = {
  members: (tripId: string) => ['trips', tripId, 'members'] as const,
  etas: (tripId: string) => ['trips', tripId, 'eta'] as const,
};

/** Everyone's ETA when the map opens and after a reconnect; live changes go to the live store. */
export function useTripEtas(tripId: string, enabled = true) {
  return useQuery({
    queryKey: liveKeys.etas(tripId),
    queryFn: () => api<Eta[]>(`/trips/${encodeURIComponent(tripId)}/eta`),
    enabled: enabled && tripId !== '',
  });
}

/** Everyone on the trip with their last spot: the live map's first load, and again after a reconnect. */
export function useLiveMembers(tripId: string, enabled = true) {
  return useQuery({
    queryKey: liveKeys.members(tripId),
    queryFn: () => api<LiveMember[]>(`/trips/${encodeURIComponent(tripId)}/members`),
    enabled: enabled && tripId !== '',
  });
}

/** Says how this person is travelling; their new ETA then arrives on the live connection. */
export function useChooseTravelMode(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: TravelMode) =>
      api<void>(`/trips/${encodeURIComponent(tripId)}/members/me/travel-mode`, {
        method: 'PUT',
        body: { mode },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liveKeys.members(tripId) }),
  });
}

/** Pauses or resumes sharing this person's location; friends keep their last spot while paused. */
export function useSetPaused(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paused: boolean) =>
      api<void>(`/trips/${encodeURIComponent(tripId)}/members/me/pause`, { method: 'PUT', body: { paused } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liveKeys.members(tripId) }),
  });
}

/** Agrees to share this person's location on the trip (the host, or someone who chose "Not now"). */
export function useStartSharing(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/trips/${encodeURIComponent(tripId)}/sharing`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liveKeys.members(tripId) }),
  });
}
