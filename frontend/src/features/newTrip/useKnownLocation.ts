import { useEffect, useState } from 'react';
import type { LatLng } from '../../lib/map/geo';

/**
 * Where the person is, but only if they already allowed location for this site: these screens never
 * ask. Used to sort search results by distance and to open the map nearby.
 */
export function useKnownLocation(): LatLng | null {
  const [here, setHere] = useState<LatLng | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!('geolocation' in navigator) || !navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (cancelled || status.state !== 'granted') return;
        navigator.geolocation.getCurrentPosition(
          (position) =>
            !cancelled && setHere({ lat: position.coords.latitude, lng: position.coords.longitude }),
          () => undefined,
          { maximumAge: 5 * 60_000, timeout: 10_000 },
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return here;
}
