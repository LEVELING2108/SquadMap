import { useCallback, useEffect, useRef, useState } from 'react';
import { Client, ReconnectionTimeMode } from '@stomp/stompjs';
import { getAccessToken, refreshSession } from '../auth/session';
import type { Eta, LiveError, LocationReading, MemberLocation, TripEvent } from './liveTypes';

export type Connection = 'connecting' | 'live' | 'offline';

/** Codes the server closes the connection with that no retry can fix. */
const FINAL_REFUSALS = new Set(['TRIP_EXPIRED', 'TRIP_NOT_FOUND', 'FORBIDDEN']);

/** A dropped connection shows as offline only after this long, so a quick reconnect doesn't flash a banner. */
export const OFFLINE_AFTER_MS = 3_000;

type Handlers = {
  onLocation: (location: MemberLocation) => void;
  onEvent: (event: TripEvent) => void;
  onEta: (eta: Eta) => void;
  /** One of this phone's own updates was refused. */
  onError: (error: LiveError) => void;
  /** Connected again after a drop: the snapshot should be reloaded, as messages were missed. */
  onReconnected: () => void;
  /** The server won't let this connection in (trip over, no longer on it, signed out). */
  onRefused: (code: string) => void;
};

/** The live connection's address: the API's host, or this page's when the API is on the same origin. */
export function liveSocketUrl(): string {
  const api = import.meta.env.VITE_API_URL;
  const base = api ? new URL(api) : window.location;
  return `${base.protocol === 'https:' ? 'wss:' : 'ws:'}//${base.host}/ws/websocket`;
}

/**
 * Keeps a live connection to one trip while `enabled`: subscribes to its locations and events, reconnects
 * after 1, 2, 4, 8 and then every 15 seconds, signs in again when the access token has run out, and stops
 * for good when the trip is over.
 */
export function useTripSocket(tripId: string, enabled: boolean, handlers: Handlers) {
  const [connection, setConnection] = useState<Connection>('connecting');
  const clientRef = useRef<Client | null>(null);
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled || tripId === '') return;
    let everConnected = false;
    let needsSignIn = false;
    let offlineTimer: ReturnType<typeof setTimeout> | undefined;
    const parse = <T>(body: string): T | null => {
      try {
        return JSON.parse(body) as T;
      } catch {
        return null;
      }
    };

    const client = new Client({
      brokerURL: liveSocketUrl(),
      reconnectDelay: 1_000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      maxReconnectDelay: 15_000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      // When heartbeats stop (signal lost), drop the socket at once instead of waiting for it to close
      // politely, which a dead network can make take minutes.
      discardWebsocketOnCommFailure: true,
      beforeConnect: async (self) => {
        if (needsSignIn) {
          needsSignIn = false;
          if (!(await refreshSession())) {
            void self.deactivate();
            handlersRef.current.onRefused('UNAUTHENTICATED');
            return;
          }
        }
        self.connectHeaders = { Authorization: `Bearer ${getAccessToken() ?? ''}` };
      },
      onConnect: () => {
        clearTimeout(offlineTimer);
        setConnection('live');
        client.subscribe(`/topic/trip.${tripId}.locations`, (message) => {
          const location = parse<MemberLocation>(message.body);
          if (location) handlersRef.current.onLocation(location);
        });
        client.subscribe(`/topic/trip.${tripId}.events`, (message) => {
          const event = parse<TripEvent>(message.body);
          if (event) handlersRef.current.onEvent(event);
        });
        client.subscribe(`/topic/trip.${tripId}.eta`, (message) => {
          const eta = parse<Eta>(message.body);
          if (eta) handlersRef.current.onEta(eta);
        });
        client.subscribe('/user/queue/errors', (message) => {
          const error = parse<LiveError>(message.body);
          if (error) handlersRef.current.onError(error);
        });
        if (everConnected) handlersRef.current.onReconnected();
        everConnected = true;
      },
      onStompError: (frame) => {
        const code = frame.headers.message ?? '';
        if (code === 'UNAUTHENTICATED') {
          // The token ran out while connected: get a fresh one before the next attempt.
          needsSignIn = true;
        } else if (FINAL_REFUSALS.has(code)) {
          void client.deactivate();
          handlersRef.current.onRefused(code);
        }
      },
      onWebSocketClose: () => {
        // Not live any more (so readings are kept for later), but not called offline unless it lasts.
        setConnection((current) => (current === 'live' ? 'connecting' : current));
        clearTimeout(offlineTimer);
        offlineTimer = setTimeout(() => {
          if (!client.connected) setConnection('offline');
        }, OFFLINE_AFTER_MS);
      },
    });
    clientRef.current = client;
    client.activate();

    // Back online: try now instead of waiting out the backoff.
    const online = () => {
      if (!client.connected && client.active) void client.deactivate().then(() => client.activate());
    };
    // The phone says it is offline: an open socket may not notice for a while, so drop it now. The client
    // keeps trying to reconnect, and the offline banner shows if that doesn't work.
    const offline = () => {
      if (client.connected) client.forceDisconnect();
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);

    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      clearTimeout(offlineTimer);
      clientRef.current = null;
      void client.deactivate();
    };
  }, [tripId, enabled]);

  /** Sends this phone's reading. False when not connected, so the caller can keep it for later. */
  const send = useCallback(
    (reading: LocationReading) => {
      const client = clientRef.current;
      if (!client?.connected) return false;
      client.publish({
        destination: `/app/trip.${tripId}.loc`,
        body: JSON.stringify(reading),
        headers: { 'content-type': 'application/json' },
      });
      return true;
    },
    [tripId],
  );

  /** The Retry button: reconnect now. */
  const retry = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;
    setConnection('connecting');
    void client.deactivate().then(() => client.activate());
  }, []);

  return { connection, send, retry };
}
