import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GeoJSONSource, GeoJSONSourceSpecification, Map as MapboxMap, Marker } from 'mapbox-gl';
import { Check } from 'lucide-react';
import mapLight from '../../assets/illustrations/map.svg';
import mapDark from '../../assets/illustrations/map-dark.svg';
import { useMapStyle, type MapStyle } from '../../features/profile/settingsApi';
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
  /**
   * When given, the map fits `fitTo` only when this changes (a "fit everyone" tap), not whenever the points
   * move: on the live map they move every few seconds, and the person may be looking somewhere else.
   */
  fitKey?: string;
  /** Changing this goes to `center` again even if it hasn't moved: a second "show where I am" tap. */
  recenterKey?: number;
  /** A destination pin at this point, separate from where the map looks. */
  destination?: LatLng | null;
  /** People on the live map: their dot, initial and name. For the eye only, like `spots`. */
  people?: MapPerson[];
  /** A person's dot was tapped. */
  onPersonClick?: (id: string) => void;
  /** The person dragged the map themselves (so a screen following someone can stop). */
  onUserMove?: () => void;
  /** A map style for this map only, in place of the account's setting (a guest's Layers choice). */
  mapStyle?: MapStyle;
  /** Routes to the destination, under the people. For the eye only: ETAs are also given in words. */
  routes?: MapRoute[];
};

export type MapSpot = { id: string; lat: number; lng: number; kind: string; selected: boolean };

export type MapPerson = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  /** Their trip colour, from the server. */
  color: string;
  /** Shown under the name for a spot that hasn't been updated lately, such as "3 min ago". */
  stale?: string;
  /** Reached the destination: a green check on the dot, as in the design. */
  arrived?: boolean;
  /** The friend whose details are open: a soft ring around the dot, as in the design. */
  selected?: boolean;
  /** Shares only a rough area: a soft circle in their colour around the dot. */
  approximate?: boolean;
};

/** How long a dot takes to glide to a new spot. Updates come every 2 to 15 seconds. */
const GLIDE_MS = 1_000;

/** A route to the destination, drawn as a dotted line in the person's colour. */
export type MapRoute = { id: string; color: string; points: [number, number][] };

const ROUTES_SOURCE = 'squadmap-routes';
const ROUTES_LAYER = 'squadmap-routes-line';

/**
 * Puts the routes on the map as one dotted line layer, adding it the first time. Called again after a
 * style change, which drops every layer the app added.
 */
function drawRoutes(map: MapboxMap, routes: MapRoute[]) {
  const data: GeoJSONSourceSpecification['data'] = {
    type: 'FeatureCollection',
    features: routes
      .filter((route) => route.points.length > 1)
      .map((route) => ({
        type: 'Feature',
        properties: { color: route.color },
        geometry: { type: 'LineString', coordinates: route.points },
      })),
  };
  const source = map.getSource(ROUTES_SOURCE) as GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource(ROUTES_SOURCE, { type: 'geojson', data });
  map.addLayer({
    id: ROUTES_LAYER,
    type: 'line',
    source: ROUTES_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-dasharray': [0, 2] },
  });
}

/** A friend on the live map: their initial in their colour, with their name below, as in the design. */
function PersonDot({ person }: { person: MapPerson }) {
  return (
    <div
      aria-hidden="true"
      className={`relative flex cursor-pointer flex-col items-center ${person.stale ? 'opacity-55 grayscale' : ''}`}
    >
      {person.approximate && (
        <span
          className="absolute top-6 left-1/2 size-28 -translate-x-1/2 -translate-y-1/2 rounded-pill border-2 border-dashed opacity-70"
          style={{ backgroundColor: `${person.color}26`, borderColor: person.color }}
        />
      )}
      <span
        className={`relative flex size-12 items-center justify-center rounded-pill border-[3px] border-screen text-lg font-extrabold text-on-person shadow-md ${
          person.selected ? 'ring-[10px] ring-you/25' : ''
        }`}
        style={{ backgroundColor: person.color }}
      >
        {person.name.charAt(0).toUpperCase()}
        {person.arrived && (
          <span className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-pill border-2 border-screen bg-green text-on-primary">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="mt-1 max-w-[120px] truncate rounded-pill bg-screen px-2 py-0.5 text-xs font-bold text-ink shadow-sm">
        {person.name}
      </span>
      {person.approximate && (
        <span className="relative mt-0.5 rounded-pill bg-screen px-1.5 text-[11px] font-semibold text-muted">
          Area only
        </span>
      )}
      {person.stale && (
        <span className="mt-0.5 rounded-pill bg-screen px-1.5 text-[11px] font-semibold text-muted">
          {person.stale}
        </span>
      )}
    </div>
  );
}

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
  fitKey: fitKeyOverride,
  recenterKey = 0,
  destination = null,
  people,
  routes,
  onPersonClick,
  onUserMove,
  mapStyle,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [mode, setMode] = useState<'loading' | 'ready' | 'fallback'>(TOKEN ? 'loading' : 'fallback');
  const [pinElement, setPinElement] = useState<HTMLElement | null>(null);
  const [youElement, setYouElement] = useState<HTMLElement | null>(null);
  const youMarkerRef = useRef<Marker | null>(null);
  const destinationMarkerRef = useRef<Marker | null>(null);
  const [destinationElement, setDestinationElement] = useState<HTMLElement | null>(null);
  const style = useMapStyle(mapStyle);
  const onPersonClickRef = useRef(onPersonClick);
  const onUserMoveRef = useRef(onUserMove);
  useEffect(() => {
    onPersonClickRef.current = onPersonClick;
    onUserMoveRef.current = onUserMove;
  });
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
        // Likewise the destination pin, for screens that show it apart from the centre.
        const destinationPin = document.createElement('div');
        destinationPin.setAttribute('aria-hidden', 'true');
        destinationMarkerRef.current = new mapboxgl.Marker({ element: destinationPin, anchor: 'bottom' });
        setDestinationElement(destinationPin);
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
        // Only a drag by the person: moves made by the app itself (fitting, centring) don't count.
        map.on('dragstart', () => onUserMoveRef.current?.());
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
    const personMarkerMap = personMarkers.current;
    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.remove());
      markers.clear();
      personMarkerMap.forEach((marker) => marker.remove());
      personMarkerMap.clear();
      destinationMarkerRef.current?.remove();
      destinationMarkerRef.current = null;
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

  // The destination pin, when it isn't the centre point.
  useEffect(() => {
    const map = mapRef.current;
    const marker = destinationMarkerRef.current;
    if (mode !== 'ready' || !map || !marker) return;
    if (destination) marker.setLngLat([destination.lng, destination.lat]).addTo(map);
    else marker.remove();
  }, [mode, destination]);

  // Routes: drawn now, and again whenever the style is replaced (a map style or theme change).
  const routesRef = useRef(routes);
  useEffect(() => {
    routesRef.current = routes;
  });
  useEffect(() => {
    const map = mapRef.current;
    if (mode !== 'ready' || !map) return;
    const draw = () => {
      try {
        drawRoutes(map, routesRef.current ?? []);
      } catch {
        // A new style is still loading (Mapbox refuses layers until then): draw once it has.
        map.once('styledata', draw);
      }
    };
    draw();
    map.on('style.load', draw);
    return () => {
      map.off('style.load', draw);
      map.off('styledata', draw);
    };
  }, [mode, routes]);

  /*
   * Gliding: a person's dot moves to a new spot over about a second instead of jumping there. One
   * animation-frame loop moves every gliding dot, and stops when none is moving. A new spot while gliding
   * starts from wherever the dot is, so updates never jerk. With reduced motion, dots jump as before.
   */
  const glides = useRef(
    new Map<string, { marker: Marker; from: [number, number]; to: [number, number]; start: number }>(),
  );
  const glideFrame = useRef<number | null>(null);
  const stepGlides = useRef((now: number) => {
    for (const [id, glide] of glides.current) {
      const t = Math.min(1, (now - glide.start) / GLIDE_MS);
      const eased = 1 - (1 - t) ** 3;
      glide.marker.setLngLat([
        glide.from[0] + (glide.to[0] - glide.from[0]) * eased,
        glide.from[1] + (glide.to[1] - glide.from[1]) * eased,
      ]);
      if (t >= 1) glides.current.delete(id);
    }
    glideFrame.current = glides.current.size > 0 ? requestAnimationFrame(stepGlides.current) : null;
  });
  function glideTo(id: string, marker: Marker, to: [number, number]) {
    const at = marker.getLngLat();
    if (at.lng === to[0] && at.lat === to[1]) return;
    if (prefersReducedMotion()) {
      glides.current.delete(id);
      marker.setLngLat(to);
      return;
    }
    glides.current.set(id, { marker, from: [at.lng, at.lat], to, start: performance.now() });
    glideFrame.current ??= requestAnimationFrame(stepGlides.current);
  }
  useEffect(
    () => () => {
      if (glideFrame.current !== null) cancelAnimationFrame(glideFrame.current);
    },
    [],
  );

  // People as DOM markers keyed by id, drawn with React through portals; moved, not recreated, on updates.
  const personMarkers = useRef(new Map<string, Marker>());
  const [personElements, setPersonElements] = useState<ReadonlyMap<string, HTMLElement>>(new Map());
  useEffect(() => {
    const map = mapRef.current;
    const MarkerClass = markerClass.current;
    if (mode !== 'ready' || !map || !MarkerClass) return;
    const wanted = new Map((people ?? []).map((person) => [person.id, person]));
    let changed = false;
    for (const [id, marker] of personMarkers.current) {
      if (!wanted.has(id)) {
        marker.remove();
        personMarkers.current.delete(id);
        glides.current.delete(id);
        changed = true;
      }
    }
    for (const person of wanted.values()) {
      const marker = personMarkers.current.get(person.id);
      if (marker) {
        glideTo(person.id, marker, [person.lng, person.lat]);
      } else {
        const element = document.createElement('div');
        element.setAttribute('aria-hidden', 'true');
        element.classList.add('map-person');
        // For the eye and the finger; keyboards and screen readers open the same screen from the list.
        element.addEventListener('click', () => onPersonClickRef.current?.(person.id));
        // The name sits below the dot; the dot itself is on the spot.
        personMarkers.current.set(
          person.id,
          new MarkerClass({ element, anchor: 'top', offset: [0, -24] })
            .setLngLat([person.lng, person.lat])
            .addTo(map),
        );
        changed = true;
      }
    }
    if (changed) {
      setPersonElements(new Map([...personMarkers.current].map(([id, marker]) => [id, marker.getElement()])));
    }
  }, [mode, people]);

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
  const fitKey =
    fitKeyOverride ?? (fitTo ?? []).map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';');
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
    const centerKey = `${center.lat},${center.lng},${zoom},${recenterKey}`;
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
  }, [mode, center.lat, center.lng, zoom, recenterKey, fitKey, padTop, padBottom, follow]);

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
      {!fallback && destination && destinationElement && createPortal(<DestinationPin />, destinationElement)}
      {!fallback &&
        (people ?? []).map((person) => {
          const element = personElements.get(person.id);
          return element ? createPortal(<PersonDot person={person} />, element, person.id) : null;
        })}
    </div>
  );
}
