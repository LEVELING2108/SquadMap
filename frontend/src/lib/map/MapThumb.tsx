import { useState } from 'react';
import mapLight from '../../assets/illustrations/map.svg';
import mapDark from '../../assets/illustrations/map-dark.svg';
import { useResolvedTheme } from '../useResolvedTheme';
import { staticMapUrl, type LatLng } from './geo';
import { DestinationPin } from './MapView';

const TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN ?? '';
/**
 * A small, still map for lists: one image from Mapbox instead of a live map per row. It is decoration
 * (the place is named next to it), and falls back to the illustrated map without a token or offline.
 */
export function MapThumb({ center, className = '' }: { center: LatLng; className?: string }) {
  const theme = useResolvedTheme();
  const [failed, setFailed] = useState(false);
  const real = TOKEN !== '' && !failed;

  return (
    // The box keeps the picture's 3:1 shape, so Mapbox's logo and credit in its corners are never cropped.
    <div aria-hidden="true" className={`relative aspect-[3/1] overflow-hidden bg-sand ${className}`}>
      {real ? (
        <img
          src={staticMapUrl(center, theme, TOKEN)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <>
          <img src={mapLight} alt="" className="size-full object-cover dark:hidden" />
          <img src={mapDark} alt="" className="hidden size-full object-cover dark:block" />
        </>
      )}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full scale-75">
        <DestinationPin />
      </div>
    </div>
  );
}
