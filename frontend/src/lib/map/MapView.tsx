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
  /** Where the person is, shown as the "You" dot; nothing when unknown. */
  you?: LatLng | null;
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
  /**
   * Parts of the map covered by panels, in px, so the centre (and the "You" dot) sits in the part people
   * can see. Not for screens where a pin drawn in the middle of the box must match the map's centre.
   */
  padding?: { top: number; bottom: number };
  /**
   * Places to mark with a small dot, such as nearby cafes. The dots are for the eye only: the screen lists
   * the same places as buttons for keyboards and screen readers.
   */
  spots?: MapSpot[];
  onSpotClick?: (id: string) => void;
  /**
   * Points the map should show all at once, such as a list of results: when this changes (and isn't
   * empty), the map zooms to fit them into the visible part.
   */
  fitTo?: LatLng[];
  /** Keep the centre in view when panels change size (a chosen place); otherwise the map stays put. */
  follow?: boolean;
};

export type MapSpot = { id: string; lat: number; lng: number; kind: string; selected: boolean };

/** The person's own position: a blue dot in a soft halo, labelled "You" as in the design. */
function YouDot() {
  return (
    <div aria-hidden="true" className="flex flex-col items-center">
      <span className="relative flex size-16 items-center justify-center">
        <span className="motion-pulse absolute inset-0 rounded-pill bg-you/25" />
        <span className="absolute inset-2 rounded-pill bg-you/20" />
        <span className="relative size-5 rounded-pill border-[3px] border-screen bg-you shadow-md" />
      </span>
      <span className="-mt-3 rounded-pill bg-screen px-2 py-0.5 text-xs font-bold text-ink shadow-sm">
        You
      </span>
    </div>
  );
}

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
  you = null,
  interactive = false,
  onCenterChange,
  onReady,
  className,
  bottomInset = 0,
  padding,
  spots,
  onSpotClick,
  fitTo,
  follow = false,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [mode, setMode] = useState<'loading' | 'ready' | 'fallback'>(TOKEN ? 'loading' : 'fallback');
  const [pinElement, setPinElement] = useState<HTMLElement | null>(null);
  const [youElement, setYouElement] = useState<HTMLElement | null>(null);
  const youMarkerRef = useRef<Marker | null>(null);
  const style = useMapStyle();
  const onCenterChangeRef = useRef(onCenterChange);
  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);
  // The map is created with the latest view (it may change while the map library loads); later changes
  // move it (see below). Pin and interactivity are fixed once the map exists.
  const initial = useRef({ pin, interactive });
  const view = useRef({ center, zoom });
  useEffect(() => {
    view.current = { center, zoom };
  }, [center, zoom]);
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
        markerClass.current = mapboxgl.Marker;
        // The "You" marker exists from the start and is put on the map while `you` is known.
        const youDot = document.createElement('div');
        youDot.setAttribute('aria-hidden', 'true');
        youMarkerRef.current = new mapboxgl.Marker({ element: youDot, anchor: 'center', offset: [0, 10] });
        setYouElement(youDot);
        const start = initial.current;
        const firstStyle = styleRef.current ?? 'mapbox/streets-v12';
        appliedStyle.current = firstStyle;
        const map = new mapboxgl.Map({
          accessToken: TOKEN,
          container,
          style: styleUrl(firstStyle),
          center: [view.current.center.lng, view.current.center.lat],
          zoom: view.current.zoom,
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
            .setLngLat([view.current.center.lng, view.current.center.lat])
            .addTo(map);
          setPinElement(element);
        }
      })
      .catch(() => !cancelled && setMode('fallback'));

    const markers = spotMarkers.current;
    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.remove());
      markers.clear();
      youMarkerRef.current?.remove();
      youMarkerRef.current = null;
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

  // The destination pin sits on the centre point.
  useEffect(() => {
    markerRef.current?.setLngLat([center.lng, center.lat]);
  }, [center.lat, center.lng]);

  // The "You" dot follows `you`; on the fallback picture there is no map to place it on.
  useEffect(() => {
    const map = mapRef.current;
    const marker = youMarkerRef.current;
    if (mode !== 'ready' || !map || !marker) return;
    if (you) marker.setLngLat([you.lng, you.lat]).addTo(map);
    else marker.remove();
  }, [mode, you]);

  // Nearby places as plain DOM markers, keyed by id; styled by .map-spot in index.css.
  const spotMarkers = useRef(new Map<string, Marker>());
  const markerClass = useRef<typeof import('mapbox-gl').Marker | null>(null);
  const onSpotClickRef = useRef(onSpotClick);
  useEffect(() => {
    onSpotClickRef.current = onSpotClick;
  }, [onSpotClick]);
  useEffect(() => {
    const map = mapRef.current;
    const MarkerClass = markerClass.current;
    if (mode !== 'ready' || !map || !MarkerClass) return;
    const wanted = new Map((spots ?? []).map((spot) => [spot.id, spot]));
    for (const [id, marker] of spotMarkers.current) {
      if (!wanted.has(id)) {
        marker.remove();
        spotMarkers.current.delete(id);
      }
    }
    for (const spot of wanted.values()) {
      let marker = spotMarkers.current.get(spot.id);
      if (!marker) {
        const element = document.createElement('div');
        element.setAttribute('aria-hidden', 'true');
        element.addEventListener('click', () => onSpotClickRef.current?.(spot.id));
        marker = new MarkerClass({ element, anchor: 'center' }).setLngLat([spot.lng, spot.lat]).addTo(map);
        spotMarkers.current.set(spot.id, marker);
      }
      // Added to Mapbox's own classes, never in place of them: those position the marker on the map.
      const element = marker.getElement();
      element.classList.add('map-spot');
      element.classList.toggle('map-spot-selected', spot.selected);
      element.dataset.kind = spot.kind;
    }
  }, [mode, spots]);

  const padTop = padding?.top ?? 0;
  const padBottom = padding?.bottom ?? 0;
  // A key for the points, so the map is refitted when they change, not on every render.
  const fitKey = (fitTo ?? []).map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';');
  const fitPoints = useRef(fitTo);
  useEffect(() => {
    fitPoints.current = fitTo;
  }, [fitTo]);
  const camera = useRef<{ centerKey: string; fitKey: string; top: number; bottom: number } | null>(null);

  /*
   * Where the map looks, decided in one place so moves never fight each other:
   * - new points to fit (results): show them all in the visible part;
   * - a new centre (a chosen place, or where you are): go there;
   * - the panels change size: keep a followed centre or the fitted points in view; otherwise, when the
   *   person is browsing freely, keep the map exactly where they left it.
   * The visible part is what the panels leave uncovered, given to Mapbox as padding.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (mode !== 'ready' || !map) return;
    const centerKey = `${center.lat},${center.lng},${zoom}`;
    const before = camera.current;
    camera.current = { centerKey, fitKey, top: padTop, bottom: padBottom };
    // The point of the world under the middle of the box, before the visible area changes: used to keep
    // the map still. Mapbox can reset padding itself (dragging does), so nothing remembered is trusted.
    const { clientWidth: width, clientHeight: height } = map.getContainer();
    const anchor = map.unproject([width / 2, height / 2]);
    map.setPadding({ top: padTop, bottom: padBottom, left: 0, right: 0 });

    const animate = !prefersReducedMotion();
    const points = fitPoints.current ?? [];
    const fit = (smooth: boolean) => {
      const lngs = points.map((p) => p.lng);
      const lats = points.map((p) => p.lat);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        // fitBounds doesn't add the map's own padding, so the panels are included here, plus a margin so
        // no point sits on the very edge.
        {
          padding: { top: padTop + 32, bottom: padBottom + 32, left: 40, right: 40 },
          maxZoom: 16,
          animate: smooth,
        },
      );
    };
    const goToCenter = (smooth: boolean) => {
      const target: [number, number] = [center.lng, center.lat];
      if (smooth) map.flyTo({ center: target, zoom, duration: 600 });
      else map.jumpTo({ center: target, zoom });
    };

    // Puts the same point back under the middle of the box: re-applying the visible area must never
    // move the map by itself (Mapbox drops its padding when the person drags, so applying it again would).
    const stayPut = () => {
      const now = map.project(anchor);
      const dx = now.x - width / 2;
      const dy = now.y - height / 2;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) map.panBy([dx, dy], { animate: false });
    };

    if (!before) {
      if (points.length > 0) fit(false);
      else goToCenter(false);
      return;
    }
    if (fitKey !== before.fitKey && points.length > 0) {
      fit(animate);
      return;
    }
    if (centerKey !== before.centerKey) {
      goToCenter(animate);
      return;
    }
    const resized = padTop !== before.top || padBottom !== before.bottom;
    if (resized && follow) {
      goToCenter(animate);
      return;
    }
    if (resized && points.length > 0) {
      fit(animate);
      return;
    }
    stayPut();
  }, [mode, center.lat, center.lng, zoom, fitKey, padTop, padBottom, follow]);

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
      {!fallback && youElement && createPortal(<YouDot />, youElement)}
    </div>
  );
}
