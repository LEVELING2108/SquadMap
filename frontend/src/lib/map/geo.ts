/** A point in WGS84 degrees. */
export type LatLng = { lat: number; lng: number };

/** Where maps open when nothing better is known: most of India in view. */
export const DEFAULT_VIEW = { center: { lat: 20.6, lng: 78.9 }, zoom: 3.6 } as const;

const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

/** "650 m", "6.2 km", "24 km"; or in miles, "500 ft", "3.9 mi", "15 mi": a distance for a list row. */
export function formatDistance(meters: number | null | undefined, unit: 'km' | 'mi' = 'km'): string | null {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return null;
  if (unit === 'mi') {
    // Under a tenth of a mile, feet read better.
    if (meters < METERS_PER_MILE / 10)
      return `${Math.max(10, Math.round(meters / METERS_PER_FOOT / 10) * 10)} ft`;
    const miles = meters / METERS_PER_MILE;
    return miles < 10 ? `${miles.toFixed(1).replace(/\.0$/, '')} mi` : `${Math.round(miles)} mi`;
  }
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  if (meters < 10_000) return `${(meters / 1000).toFixed(1).replace(/\.0$/, '')} km`;
  return `${Math.round(meters / 1000)} km`;
}

/**
 * The address of a still map picture of a place, from Mapbox's Static Images API.
 *
 * @param style a Mapbox style as "owner/style", for example "mapbox/streets-v12"
 */
export function staticMapUrl(center: LatLng, style: string, token: string): string {
  // Five decimals is about a metre: plenty for a thumbnail, and it keeps addresses cacheable.
  const at = `${center.lng.toFixed(5)},${center.lat.toFixed(5)},13.5,0`;
  return `https://api.mapbox.com/styles/v1/${style}/static/${at}/600x200@2x?access_token=${encodeURIComponent(token)}`;
}

/** About 220 m: the size of the area a rough location falls in. Matches the server (GeoMath.area). */
export const AREA_STEP_DEG = 0.002;

/**
 * The centre of the roughly 220 m square a point falls in, for sharing an area instead of a spot. Done on
 * the phone, so the exact spot never leaves it; the server snaps again the same way.
 */
export function toArea(lat: number, lng: number): { lat: number; lng: number } {
  const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
  const snappedLat = Math.round(lat / AREA_STEP_DEG) * AREA_STEP_DEG;
  // Lines of longitude draw together towards the poles, so the step widens to keep the square square.
  const lngStep = AREA_STEP_DEG / Math.max(0.2, Math.cos((snappedLat * Math.PI) / 180));
  const snappedLng = Math.round(lng / lngStep) * lngStep;
  return { lat: round6(snappedLat), lng: round6(Math.max(-180, Math.min(180, snappedLng))) };
}
