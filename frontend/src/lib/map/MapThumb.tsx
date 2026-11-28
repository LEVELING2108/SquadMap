import { Illustration } from '../../components/ui/Illustration';
import { useState } from 'react';
import { useMapStyle } from '../../features/profile/settingsApi';
import { ATLAS_BASE_STYLE, ATLAS_STYLE } from './atlasStyle';
import { staticMapUrl, type LatLng } from './geo';
import { DestinationPin } from './MapView';

const TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN ?? '';
/**
 * A small, still map for lists: one image from Mapbox instead of a live map per row. It is decoration
 * (the place is named next to it), and falls back to the illustrated map without a token or offline.
 */
export function MapThumb({ center, className = '' }: { center: LatLng; className?: string }) {
  const style = useMapStyle();
  const [failed, setFailed] = useState(false);
  const real = TOKEN !== '' && !failed;
  // Until the account's map style is known, keep the space without asking Mapbox for a picture.
  if (real && style === null) {
    return (
      <div aria-hidden="true" className={`relative aspect-[3/1] overflow-hidden bg-sand ${className}`} />
    );
  }

  return (
    // The box keeps the picture's 3:1 shape, so Mapbox's logo and credit in its corners are never cropped.
    <div aria-hidden="true" className={`relative aspect-[3/1] overflow-hidden bg-sand ${className}`}>
      {real ? (
        // Mapbox's picture service only knows its own styles, so in Atlas the Streets picture gets a paper tint.
        <img
          src={staticMapUrl(
            center,
            style === ATLAS_STYLE ? ATLAS_BASE_STYLE : (style ?? ATLAS_BASE_STYLE),
            TOKEN,
          )}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={`size-full object-cover ${style === ATLAS_STYLE ? 'saturate-[0.7] sepia-[0.35]' : ''}`}
        />
      ) : (
        <>
          <Illustration name="map" className="size-full object-cover" />
        </>
      )}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full scale-75">
        <DestinationPin />
      </div>
    </div>
  );
}
