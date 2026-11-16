import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import type { LatLng } from '../../lib/map/geo';
import type { PlaceResult } from './types';

export const placeKeys = {
  search: (query: string, near: LatLng | null) => ['places', 'search', query, near] as const,
  recent: ['places', 'recent'] as const,
};

/** Searches once the text is at least 2 characters. Results are kept briefly, never stored. */
export function usePlaceSearch(query: string, near: LatLng | null) {
  const text = query.trim();
  return useQuery({
    queryKey: placeKeys.search(text, near),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ q: text });
      if (near) params.set('near', `${near.lat.toFixed(5)},${near.lng.toFixed(5)}`);
      return api<PlaceResult[]>(`/places/search?${params.toString()}`, { signal });
    },
    enabled: text.length >= 2,
    staleTime: 60_000,
    // Typing again is the retry; waiting seconds before saying search is down helps no one.
    retry: false,
  });
}

export function useRecentPlaces() {
  return useQuery({ queryKey: placeKeys.recent, queryFn: () => api<PlaceResult[]>('/places/recent') });
}
