/** A point in WGS84 degrees. */
export type LatLng = { lat: number; lng: number };

/** Where maps open when nothing better is known: most of India in view. */
export const DEFAULT_VIEW = { center: { lat: 20.6, lng: 78.9 }, zoom: 3.6 } as const;

/** "650 m", "6 km", "24 km": a distance for a list row. */
export function formatDistance(meters: number | null | undefined): string | null {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  if (meters < 10_000) return `${(meters / 1000).toFixed(1).replace(/\.0$/, '')} km`;
  return `${Math.round(meters / 1000)} km`;
}
