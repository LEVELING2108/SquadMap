import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Map as MapboxMap, Marker } from 'mapbox-gl';
import mapLight from '../../assets/illustrations/map.svg';
import mapDark from '../../assets/illustrations/map-dark.svg';
import { useMapStyle } from '../../features/profile/settingsApi';
import type { LatLng } from './geo';

const TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN ?? '';

/** "mapbox/streets-v12" becomes the address Mapbox GL loads. */
const styleUrl = (style: string) => `mapbox://styles/${style}`;

type MapViewProps = {
  center: LatLng;
  zoom: number;
  /** What the map shows, for people who can't see it. */
  label: string;
  /** A destination pin on the centre point. */
  pin?: boolean;
  /** Lets the person pan and zoom; reports where the centre ends up. */
  interactive?: boolean;
  onCenterChange?: (center: LatLng) => void;
  /** Told once whether a real map is showing, or the picture instead. */
  onReady?: (real: boolean) => void;
  /** Must place and size the map, for example "absolute inset-0" or "relative h-80". */
  className: string;
  /**
   * How much of the map's bottom edge a panel covers, in px. Mapbox's logo and credits sit above it:
   * their terms require both to stay visible.
   */
  bottomInset?: number;
};

/** The pin drawn on the map and on the fallback picture: coral, as destinations are in the design. */
export function DestinationPin({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 44 56" className={`h-14 w-11 drop-shadow-md ${className}`}>
      <ellipse cx="22" cy="52" rx="10" ry="3.5" className="fill-coral/35" />
      <path
        d="M22 2C11.5 2 3 10.3 3 20.6 3 34.5 22 52 22 52s19-17.5 19-31.4C41 10.3 32.5 2 22 2Z"
        className="fill-coral stroke-screen"
        strokeWidth="3"
      />
      <circle cx="22" cy="20" r="7" className="fill-screen" />
    </svg>
  );
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  // The account's "Reduce animations" setting, or the device's own preference.
  if (document.documentElement.hasAttribute('data-reduce-motion')) return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * A Mapbox map, loaded only when a screen shows one. Without a token, or when the map can't load
 * (no WebGL, offline, blocked), it shows the illustrated map instead, so the screen still works.
 */
export function MapView({
  center,
  zoom,
  label,
  pin = false,
  interactive = false,
  onCenterChange,
  onReady,
  className,
  bottomInset = 0,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [mode, setMode] = useState<'loading' | 'ready' | 'fallback'>(TOKEN ? 'loading' : 'fallback');
  const [pinElement, setPinElement] = useState<HTMLElement | null>(null);
  const style = useMapStyle();
  const onCenterChangeRef = useRef(onCenterChange);
  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);
  // The first view is set once; later changes move the map (see below).
  const initial = useRef({ center, zoom, pin, interactive });
  const styleRef = useRef(style);
  const appliedStyle = useRef<string | null>(null);
  useEffect(() => {
    styleRef.current = style;
  }, [style]);
  // The map is created once its style is known (see useMapStyle), not drawn twice.
  const styleKnown = style !== null;

  useEffect(() => {
    if (!TOKEN || !styleKnown || !containerRef.current) return;
    let cancelled = false;
    const container = containerRef.current;

    Promise.all([import('mapbox-gl'), import('mapbox-gl/dist/mapbox-gl.css')])
      .then(([{ default: mapboxgl }]) => {
        if (cancelled) return;
        const start = initial.current;
        const firstStyle = styleRef.current ?? 'mapbox/streets-v12';
        appliedStyle.current = firstStyle;
        const map = new mapboxgl.Map({
          accessToken: TOKEN,
          container,
          style: styleUrl(firstStyle),
          center: [start.center.lng, start.center.lat],
          zoom: start.zoom,
          interactive: start.interactive,
          attributionControl: true,
          // The map is decoration on most screens; keyboard and screen reader users get the label instead.
          keyboard: start.interactive,
          cooperativeGestures: false,
        });
        mapRef.current = map;
        map.on('load', () => !cancelled && setMode('ready'));
        // Before the first load, any error (bad token, blocked, offline) means the picture is better.
        map.on('error', () => {
          if (!cancelled && !map.loaded()) setMode('fallback');
        });
        map.on('moveend', () => {
          const c = map.getCenter();
          onCenterChangeRef.current?.({ lat: c.lat, lng: c.lng });
        });
        if (start.pin) {
          const element = document.createElement('div');
          element.setAttribute('aria-hidden', 'true');
          markerRef.current = new mapboxgl.Marker({ element, anchor: 'bottom' })
            .setLngLat([start.center.lng, start.center.lat])
            .addTo(map);
          setPinElement(element);
        }
      })
      .catch(() => !cancelled && setMode('fallback'));

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [styleKnown]);

  useEffect(() => {
    if (!style || !mapRef.current || appliedStyle.current === style) return;
    appliedStyle.current = style;
    mapRef.current.setStyle(styleUrl(style));
  }, [style]);

  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  useEffect(() => {
    if (mode !== 'loading') onReadyRef.current?.(mode === 'ready');
  }, [mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const target: [number, number] = [center.lng, center.lat];
    markerRef.current?.setLngLat(target);
    const here = map.getCenter();
    if (Math.abs(here.lat - center.lat) < 1e-7 && Math.abs(here.lng - center.lng) < 1e-7) return;
    if (prefersReducedMotion()) map.jumpTo({ center: target, zoom });
    else map.flyTo({ center: target, zoom, duration: 600 });
  }, [center.lat, center.lng, zoom]);

  const fallback = mode === 'fallback';

  return (
    <div
      // The picture is one image with a description. The real map is not: Mapbox puts its own controls
      // (credits, and the canvas when it can be moved) inside, and those must stay reachable.
      role={fallback ? 'img' : undefined}
      aria-label={fallback ? label : undefined}
      // No position here: the caller's className places it, and a second position class could override it.
      className={`overflow-hidden bg-sand ${className}`}
      style={{ '--map-inset-bottom': `${bottomInset}px` } as React.CSSProperties}
    >
      {fallback ? (
        <>
          <img src={mapLight} alt="" className="size-full object-cover dark:hidden" />
          <img src={mapDark} alt="" className="hidden size-full object-cover dark:block" />
          {pin && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
              <DestinationPin />
            </div>
          )}
        </>
      ) : (
        <>
          <p className="sr-only">{label}</p>
          {/* Sized with width and height, not inset: Mapbox's stylesheet makes its container position: relative. */}
          <div ref={containerRef} className="map-canvas size-full" />
        </>
      )}
      {!fallback && pinElement && createPortal(<DestinationPin />, pinElement)}
    </div>
  );
}
