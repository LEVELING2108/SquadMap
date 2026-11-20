import { useEffect, useRef, useState } from 'react';
import { toArea } from '../../lib/map/geo';
import type { LocationReading } from './liveTypes';

/** The server refuses more than one update per 2 seconds. */
export const MIN_INTERVAL_MS = 2_000;
/** Standing still, a reading goes out this often anyway, so friends don't see the dot go stale. */
export const KEEP_FRESH_MS = 15_000;
/** Moving less than this between readings counts as standing still. */
export const MIN_MOVE_M = 10;
/** The server refuses readings vaguer than this. */
export const MAX_ACCURACY_M = 200;
/** A reading kept while offline is still worth sending for this long (the server's own limit). */
export const MAX_QUEUED_AGE_MS = 5 * 60_000;

export type Sharing =
  { kind: 'off' } | { kind: 'asking' } | { kind: 'on' } | { kind: 'denied' } | { kind: 'unavailable' };

type Sent = { lat: number; lng: number; at: number };

/** Great-circle distance in metres. */
export function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Whether a new reading is worth sending: never within 2 seconds of the last one; then when the person
 * has moved, or every 15 seconds when they haven't. Saves battery and data while standing still.
 */
export function shouldSend(last: Sent | null, next: { lat: number; lng: number }, now: number): boolean {
  if (!last) return true;
  const elapsed = now - last.at;
  if (elapsed < MIN_INTERVAL_MS) return false;
  return metresBetween(last, next) >= MIN_MOVE_M || elapsed >= KEEP_FRESH_MS;
}

function toReading(position: GeolocationPosition): LocationReading {
  const { latitude, longitude, accuracy, speed, heading } = position.coords;
  return {
    lat: latitude,
    lng: longitude,
    acc: accuracy,
    ...(speed !== null && Number.isFinite(speed) ? { speed } : {}),
    ...(heading !== null && Number.isFinite(heading) ? { heading } : {}),
    ts: new Date(position.timestamp).toISOString(),
  };
}

/** What friends get when precise location is off: the area's centre, and nothing that narrows it down. */
export function roughly(reading: LocationReading): LocationReading {
  return { ...toArea(reading.lat, reading.lng), acc: reading.acc, ts: reading.ts, approximate: true };
}

/**
 * Watches this phone's location while `enabled` and hands readings to `send`. With `approximate`, only the
 * rough area is sent; this phone still shows its own exact spot. The browser asks for
 * permission the first time. While the live connection is down, the newest reading is kept and sent once it
 * is back (older ones would be ignored anyway).
 */
export function useLocationSharing({
  enabled,
  connected,
  send,
  approximate = false,
}: {
  enabled: boolean;
  connected: boolean;
  send: (reading: LocationReading) => boolean;
  approximate?: boolean;
}) {
  // What the browser said; before it says anything, the state is worked out below.
  const [answer, setAnswer] = useState<'on' | 'denied' | null>(null);
  const [you, setYou] = useState<LocationReading | null>(null);
  const lastSent = useRef<Sent | null>(null);
  const pending = useRef<LocationReading | null>(null);
  const sendRef = useRef(send);
  const approximateRef = useRef(approximate);
  useEffect(() => {
    sendRef.current = send;
    approximateRef.current = approximate;
  });

  const supported =
    typeof navigator !== 'undefined' && typeof navigator.geolocation?.watchPosition === 'function';

  useEffect(() => {
    if (!enabled || !supported) return;
    const geolocation = navigator.geolocation;
    const watch = geolocation.watchPosition(
      (position) => {
        const reading = toReading(position);
        setAnswer('on');
        setYou(reading);
        if (reading.acc > MAX_ACCURACY_M) return;
        const now = Date.now();
        if (!shouldSend(lastSent.current, reading, now)) return;
        const outgoing = approximateRef.current ? roughly(reading) : reading;
        if (sendRef.current(outgoing)) {
          lastSent.current = { lat: reading.lat, lng: reading.lng, at: now };
          pending.current = null;
        } else {
          pending.current = outgoing;
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setAnswer('denied');
        // A timeout or no fix yet: the watch keeps trying by itself.
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
    return () => geolocation.clearWatch(watch);
  }, [enabled, supported]);

  // Back online: send the reading kept while offline, if it is still recent enough.
  useEffect(() => {
    const kept = pending.current;
    if (!connected || !kept) return;
    pending.current = null;
    if (Date.now() - Date.parse(kept.ts) > MAX_QUEUED_AGE_MS) return;
    if (sendRef.current(kept)) lastSent.current = { lat: kept.lat, lng: kept.lng, at: Date.now() };
  }, [connected]);

  const sharing: Sharing = !enabled
    ? { kind: 'off' }
    : !supported
      ? { kind: 'unavailable' }
      : answer
        ? { kind: answer }
        : { kind: 'asking' };
  return { sharing, you };
}
