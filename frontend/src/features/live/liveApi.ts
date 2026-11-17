import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import type { LiveMember } from './liveTypes';

export const liveKeys = {
  members: (tripId: string) => ['trips', tripId, 'members'] as const,
};

/** Everyone on the trip with their last spot: the live map's first load, and again after a reconnect. */
export function useLiveMembers(tripId: string, enabled = true) {
  return useQuery({
    queryKey: liveKeys.members(tripId),
    queryFn: () => api<LiveMember[]>(`/trips/${encodeURIComponent(tripId)}/members`),
    enabled: enabled && tripId !== '',
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
