'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getWsBase } from '../lib/api';
import {
  LocationBroadcast,
  EtaParticipant,
  ChatMessage,
  PresenceEvent,
  ArrivedEvent,
  WebRtcSignal,
} from '../types/squad';

interface UseSquadSocketProps {
  sessionCode: string;
  userId: string;
  displayName: string;
  colorHex: string;
  onLocationUpdate?: (location: LocationBroadcast) => void;
  onEtaUpdate?: (etas: EtaParticipant[]) => void;
  onChatMessage?: (message: ChatMessage) => void;
  onPresence?: (presence: PresenceEvent) => void;
  onArrived?: (arrived: ArrivedEvent) => void;
  onDestinationUpdate?: (dest: { destinationName?: string; destinationLat: number; destinationLng: number }) => void;
  onSystemEvent?: (event: any) => void;
  onWebRtcSignal?: (signal: WebRtcSignal) => void;
}

export function useSquadSocket({
  sessionCode,
  userId,
  displayName,
  colorHex,
  onLocationUpdate,
  onEtaUpdate,
  onChatMessage,
  onPresence,
  onArrived,
  onDestinationUpdate,
  onSystemEvent,
  onWebRtcSignal,
}: UseSquadSocketProps) {
  const [isConnected, setIsConnected] = useState(false);
  const stompClientRef = useRef<Client | null>(null);

  // Keep callback refs fresh
  const onLocationUpdateRef = useRef(onLocationUpdate);
  onLocationUpdateRef.current = onLocationUpdate;

  const onEtaUpdateRef = useRef(onEtaUpdate);
  onEtaUpdateRef.current = onEtaUpdate;

  const onChatMessageRef = useRef(onChatMessage);
  onChatMessageRef.current = onChatMessage;

  const onPresenceRef = useRef(onPresence);
  onPresenceRef.current = onPresence;

  const onArrivedRef = useRef(onArrived);
  onArrivedRef.current = onArrived;

  const onDestinationUpdateRef = useRef(onDestinationUpdate);
  onDestinationUpdateRef.current = onDestinationUpdate;

  const onSystemEventRef = useRef(onSystemEvent);
  onSystemEventRef.current = onSystemEvent;

  const onWebRtcSignalRef = useRef(onWebRtcSignal);
  onWebRtcSignalRef.current = onWebRtcSignal;

  useEffect(() => {
    if (!sessionCode || !userId) return;

    const normalizedCode = sessionCode.toUpperCase();

    const client = new Client({
      webSocketFactory: () => new SockJS(getWsBase()),
      reconnectDelay: 3000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (msg) => {
        // console.debug('[STOMP]', msg);
      },
      onConnect: () => {
        setIsConnected(true);

        // 1. Subscribe to Location broadcasts
        client.subscribe(`/topic/session/${normalizedCode}/location`, (msg) => {
          try {
            const loc: LocationBroadcast = JSON.parse(msg.body);
            onLocationUpdateRef.current?.(loc);
          } catch (e) {
            console.error('Error parsing location:', e);
          }
        });

        // 2. Subscribe to ETA updates
        client.subscribe(`/topic/session/${normalizedCode}/eta`, (msg) => {
          try {
            const etas: EtaParticipant[] = JSON.parse(msg.body);
            onEtaUpdateRef.current?.(etas);
          } catch (e) {
            console.error('Error parsing ETA:', e);
          }
        });

        // 3. Subscribe to Chat messages
        client.subscribe(`/topic/session/${normalizedCode}/chat`, (msg) => {
          try {
            const chat: ChatMessage = JSON.parse(msg.body);
            onChatMessageRef.current?.(chat);
          } catch (e) {
            console.error('Error parsing chat:', e);
          }
        });

        // 4. Subscribe to Presence updates
        client.subscribe(`/topic/session/${normalizedCode}/presence`, (msg) => {
          try {
            const presence: PresenceEvent = JSON.parse(msg.body);
            onPresenceRef.current?.(presence);
          } catch (e) {
            console.error('Error parsing presence:', e);
          }
        });

        // 5. Subscribe to Destination updates
        client.subscribe(`/topic/session/${normalizedCode}/destination`, (msg) => {
          try {
            const dest = JSON.parse(msg.body);
            onDestinationUpdateRef.current?.(dest);
          } catch (e) {
            console.error('Error parsing destination:', e);
          }
        });

        // 6. Subscribe to Arrival alerts (< 100m geofence)
        client.subscribe(`/topic/session/${normalizedCode}/arrived`, (msg) => {
          try {
            const arrived: ArrivedEvent = JSON.parse(msg.body);
            onArrivedRef.current?.(arrived);
          } catch (e) {
            console.error('Error parsing arrived event:', e);
          }
        });

        // 7. Subscribe to System events
        client.subscribe(`/topic/session/${normalizedCode}/system`, (msg) => {
          try {
            const sys = JSON.parse(msg.body);
            onSystemEventRef.current?.(sys);
          } catch (e) {
            console.error('Error parsing system event:', e);
          }
        });

        // 8. Subscribe to WebRTC Voice Walkie-Talkie signals
        client.subscribe(`/topic/session/${normalizedCode}/webrtc`, (msg) => {
          try {
            const signal: WebRtcSignal = JSON.parse(msg.body);
            onWebRtcSignalRef.current?.(signal);
          } catch (e) {
            console.error('Error parsing webrtc signal:', e);
          }
        });

        // Announce presence on join
        client.publish({
          destination: '/app/session.join',
          body: JSON.stringify({
            sessionCode: normalizedCode,
            userId,
            displayName,
            colorHex,
          }),
        });
      },
      onDisconnect: () => {
        setIsConnected(false);
      },
      onStompError: (frame) => {
        console.error('STOMP protocol error:', frame.headers['message']);
      },
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      client.deactivate();
      stompClientRef.current = null;
      setIsConnected(false);
    };
  }, [sessionCode, userId, displayName, colorHex]);

  const sendLocation = useCallback(
    (lat: number, lng: number, speed: number, heading: number, isPaused: boolean = false) => {
      if (!stompClientRef.current?.connected) return;

      stompClientRef.current.publish({
        destination: '/app/location.update',
        body: JSON.stringify({
          sessionCode: sessionCode.toUpperCase(),
          userId,
          lat,
          lng,
          speed,
          heading,
          isPaused,
        }),
      });
    },
    [sessionCode, userId]
  );

  const togglePause = useCallback(
    (isPaused: boolean) => {
      if (!stompClientRef.current?.connected) return;

      stompClientRef.current.publish({
        destination: '/app/location.pause',
        body: JSON.stringify({
          sessionCode: sessionCode.toUpperCase(),
          userId,
          isPaused,
        }),
      });
    },
    [sessionCode, userId]
  );

  const sendChat = useCallback(
    (text: string, isQuickReply: boolean = false) => {
      if (!stompClientRef.current?.connected) return;

      stompClientRef.current.publish({
        destination: '/app/chat.send',
        body: JSON.stringify({
          sessionCode: sessionCode.toUpperCase(),
          senderId: userId,
          senderName: displayName,
          text,
          isQuickReply,
        }),
      });
    },
    [sessionCode, userId, displayName]
  );

  const sendWebRtcSignal = useCallback(
    (type: WebRtcSignal['type'], targetId?: string | null, payload?: any) => {
      if (!stompClientRef.current?.connected) return;

      const signal: WebRtcSignal = {
        sessionCode: sessionCode.toUpperCase(),
        type,
        senderId: userId,
        senderName: displayName,
        targetId: targetId || null,
        payload,
      };

      stompClientRef.current.publish({
        destination: '/app/webrtc.signal',
        body: JSON.stringify(signal),
      });
    },
    [sessionCode, userId, displayName]
  );

  return {
    isConnected,
    sendLocation,
    togglePause,
    sendChat,
    sendWebRtcSignal,
  };
}
