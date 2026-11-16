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

const STATIC_STYLES = { light: 'mapbox/streets-v12', dark: 'mapbox/dark-v11' } as const;

/** The address of a still map picture of a place, from Mapbox's Static Images API. */
export function staticMapUrl(center: LatLng, theme: 'light' | 'dark', token: string): string {
  // Five decimals is about a metre: plenty for a thumbnail, and it keeps addresses cacheable.
  const at = `${center.lng.toFixed(5)},${center.lat.toFixed(5)},13.5,0`;
  return `https://api.mapbox.com/styles/v1/${STATIC_STYLES[theme]}/static/${at}/600x200@2x?access_token=${encodeURIComponent(token)}`;
}
