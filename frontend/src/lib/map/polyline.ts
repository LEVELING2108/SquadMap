/**
 * Decodes an encoded polyline (Google's format, as Mapbox Directions returns it) into [lng, lat] pairs,
 * the order Mapbox GL draws in. Precision 6 matches `geometries=polyline6`.
 */
export function decodePolyline(encoded: string, precision = 6): [number, number][] {
  const factor = 10 ** precision;
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = (): number | null => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) return null;
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    const dLat = next();
    const dLng = next();
    // A cut-off string ends the line rather than drawing a point that isn't there.
    if (dLat === null || dLng === null) break;
    lat += dLat;
    lng += dLng;
    points.push([lng / factor, lat / factor]);
  }
  return points;
}
