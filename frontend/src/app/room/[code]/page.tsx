'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, getEtas, getRecentChat } from '../../../lib/api';
import { Session, Participant, EtaParticipant, ChatMessage, ArrivedEvent } from '../../../types/squad';
import { useSquadSocket } from '../../../hooks/useSquadSocket';
import { useAdaptiveGeolocation } from '../../../hooks/useAdaptiveGeolocation';
import { useWebRtcWalkieTalkie } from '../../../hooks/useWebRtcWalkieTalkie';
import { MapComponent } from '../../../components/MapComponent';
import { MobileTopBar } from '../../../components/MobileTopBar';
import { MobileMapControls } from '../../../components/MobileMapControls';
import { MobileBottomSheet } from '../../../components/MobileBottomSheet';
import { MobilePttBar } from '../../../components/MobilePttBar';
import { SquadChat } from '../../../components/SquadChat';
import { ShareModal } from '../../../components/ShareModal';
import { ArrivalCelebration } from '../../../components/ArrivalCelebration';
import { Loader2 } from 'lucide-react';

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const sessionCode = rawCode.toUpperCase();
  const router = useRouter();

  // Local user credentials
  const [userId, setUserId] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [colorHex, setColorHex] = useState<string>('#3B82F6');

  // Room state
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [etas, setEtas] = useState<EtaParticipant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [latestArrival, setLatestArrival] = useState<ArrivedEvent | null>(null);

  // Camera action state for MapLibre GL
  const [cameraAction, setCameraAction] = useState<{
    type: 'FOLLOW_ME' | 'FIT_ALL' | 'NORTH_UP' | 'FOCUS_USER';
    userId?: string;
    timestamp: number;
  } | null>(null);

  // UI Modals state
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);

  // Load user credentials from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedUser = localStorage.getItem(`squad_user_${sessionCode}`);
    const storedName = localStorage.getItem(`squad_name_${sessionCode}`);
    const storedColor = localStorage.getItem(`squad_color_${sessionCode}`);

    if (!storedUser || !storedName) {
      router.push(`/join/${sessionCode}`);
      return;
    }

    setUserId(storedUser);
    setDisplayName(storedName);
    if (storedColor) setColorHex(storedColor);
  }, [sessionCode, router]);

  // Initial fetch of session, ETAs, and chat history
  useEffect(() => {
    if (!sessionCode) return;

    let isMounted = true;
    async function loadInitialData() {
      try {
        const [sessData, etasData, chatData] = await Promise.all([
          getSession(sessionCode),
          getEtas(sessionCode).catch(() => []),
          getRecentChat(sessionCode).catch(() => []),
        ]);

        if (!isMounted) return;
        setSession(sessData);
        setParticipants(sessData.participants || []);
        setEtas(etasData);
        setMessages(chatData);
      } catch (err: any) {
        console.error('Failed to load room:', err);
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    }

    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [sessionCode]);

  // STOMP WebSocket setup
  const {
    isConnected,
    sendLocation,
    togglePause: socketTogglePause,
    sendChat: socketSendChat,
    sendWebRtcSignal,
  } = useSquadSocket({
    sessionCode,
    userId,
    displayName,
    colorHex,
    onLocationUpdate: (loc) => {
      setParticipants((prev) => {
        const index = prev.findIndex((p) => p.id === loc.userId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            lat: loc.lat,
            lng: loc.lng,
            speed: loc.speed,
            heading: loc.heading,
            isPaused: loc.isPaused,
            hasArrived: loc.hasArrived,
            lastPing: loc.timestamp,
          };
          return updated;
        }
        return prev;
      });
    },
    onEtaUpdate: (newEtas) => {
      setEtas(newEtas);
    },
    onChatMessage: (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (!isChatOpen) {
        setUnreadChatCount((c) => c + 1);
      }
    },
    onPresence: (presence) => {
      if (presence.action === 'JOIN') {
        setParticipants((prev) => {
          if (prev.some((p) => p.id === presence.userId)) return prev;
          return [
            ...prev,
            {
              id: presence.userId,
              displayName: presence.displayName,
              colorHex: presence.colorHex,
              isPaused: false,
              hasArrived: false,
              joinedAt: presence.timestamp,
            },
          ];
        });
      }
    },
    onArrived: (arrived) => {
      setLatestArrival(arrived);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
      }
      setParticipants((prev) =>
        prev.map((p) => (p.id === arrived.userId ? { ...p, hasArrived: true } : p))
      );
    },
    onDestinationUpdate: (dest) => {
      setSession((prev) =>
        prev
          ? {
              ...prev,
              destinationName: dest.destinationName,
              destinationLat: dest.destinationLat,
              destinationLng: dest.destinationLng,
            }
          : prev
      );
    },
    onWebRtcSignal: (signal) => {
      walkieTalkie.handleIncomingSignal(signal);
    },
  });

  // Battery-Aware Adaptive GPS Engine
  const {
    speed,
    mode,
    intervalSeconds,
    isPaused,
    isSimulating,
    togglePause: localTogglePause,
    startSimulation,
    stopSimulation,
  } = useAdaptiveGeolocation({
    enabled: !!userId && isConnected,
    destinationLat: session?.destinationLat,
    destinationLng: session?.destinationLng,
    onLocationChange: (lat, lng, spd, hdg, paused) => {
      sendLocation(lat, lng, spd, hdg, paused);
      setParticipants((prev) => {
        const index = prev.findIndex((p) => p.id === userId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            lat,
            lng,
            speed: spd,
            heading: hdg,
            isPaused: paused,
          };
          return updated;
        }
        return prev;
      });
    },
  });

  // WebRTC Push-To-Talk Walkie-Talkie
  const walkieTalkie = useWebRtcWalkieTalkie({
    sessionCode,
    userId,
    displayName,
    onSendSignal: sendWebRtcSignal,
  });

  // Camera Action Triggers
  const handleFollowMe = useCallback(() => {
    setCameraAction({ type: 'FOLLOW_ME', timestamp: Date.now() });
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
  }, []);

  const handleNorthUp = useCallback(() => {
    setCameraAction({ type: 'NORTH_UP', timestamp: Date.now() });
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
  }, []);

  const handleFocusMember = useCallback((memberId: string) => {
    setCameraAction({ type: 'FOCUS_USER', userId: memberId, timestamp: Date.now() });
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
  }, []);

  // Toggle Pause
  const handleTogglePause = useCallback(() => {
    localTogglePause();
    socketTogglePause(!isPaused);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
  }, [localTogglePause, socketTogglePause, isPaused]);

  // Toggle Simulate
  const handleToggleSimulate = useCallback(() => {
    if (isSimulating) stopSimulation();
    else startSimulation();
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
  }, [isSimulating, startSimulation, stopSimulation]);

  // Chat message sender
  const handleSendMessage = (text: string, isQuickReply: boolean) => {
    socketSendChat(text, isQuickReply);
  };

  if (initialLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#090d16] text-white">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-3" />
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Joining Convoy...
        </p>
      </div>
    );
  }

  return (
    <main className="relative h-full w-full overflow-hidden bg-[#090d16] flex flex-col">
      {/* 1. Full-Bleed Map Engine */}
      <div className="absolute inset-0 z-0">
        <MapComponent
          currentUserId={userId}
          destinationLat={session?.destinationLat}
          destinationLng={session?.destinationLng}
          destinationName={session?.destinationName}
          participants={participants}
          etas={etas}
          cameraAction={cameraAction}
        />
      </div>

      {/* 2. Top Dynamic Island Header */}
      <MobileTopBar
        tripName={session?.name || 'Road Trip'}
        sessionCode={sessionCode}
        isConnected={isConnected}
        currentSpeed={speed}
        gpsMode={mode}
        intervalSeconds={intervalSeconds}
      />

      {/* 3. Right-Side Thumb Action Cluster FABs */}
      <MobileMapControls
        isSimulating={isSimulating}
        isPaused={isPaused}
        onFollowMe={handleFollowMe}
        onNorthUp={handleNorthUp}
        onToggleSimulate={handleToggleSimulate}
        onTogglePause={handleTogglePause}
        onOpenShare={() => setIsShareOpen(true)}
      />

      {/* 4. Bottom Thumb Zone: Push-To-Talk Mic Button & Chat Bubble */}
      <MobilePttBar
        isMicReady={walkieTalkie.isMicReady}
        isTalking={walkieTalkie.isTalking}
        activeSpeaker={walkieTalkie.activeSpeaker}
        unreadChatCount={unreadChatCount}
        onEnableMic={walkieTalkie.enableMicrophone}
        onStartTalking={walkieTalkie.startTalking}
        onStopTalking={walkieTalkie.stopTalking}
        onOpenChat={() => {
          setIsChatOpen(true);
          setUnreadChatCount(0);
        }}
      />

      {/* 5. Mobile Draggable Bottom Sheet (Apple Maps style) */}
      <MobileBottomSheet
        destinationName={session?.destinationName}
        destinationLat={session?.destinationLat}
        destinationLng={session?.destinationLng}
        participants={participants}
        etas={etas}
        currentUserId={userId}
        onFocusMember={handleFocusMember}
        onOpenShare={() => setIsShareOpen(true)}
      />

      {/* 6. iOS / Android Bottom Sheet Squad Chat */}
      <SquadChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        currentUserId={userId}
        onSendMessage={handleSendMessage}
      />

      {/* 7. Share & QR Code Modal */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        sessionCode={sessionCode}
        tripName={session?.name || 'Road Trip'}
      />

      {/* 8. Geofence Arrival Celebration */}
      <ArrivalCelebration
        arrival={latestArrival}
        onDismiss={() => setLatestArrival(null)}
      />
    </main>
  );
}
