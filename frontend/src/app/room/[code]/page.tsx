'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, getEtas, getRecentChat, sendChat as apiSendChat } from '../../../lib/api';
import { Session, Participant, EtaParticipant, ChatMessage, ArrivedEvent } from '../../../types/squad';
import { useSquadSocket } from '../../../hooks/useSquadSocket';
import { useAdaptiveGeolocation } from '../../../hooks/useAdaptiveGeolocation';
import { useWebRtcWalkieTalkie } from '../../../hooks/useWebRtcWalkieTalkie';
import { MapComponent } from '../../../components/MapComponent';
import { EtaLeaderboard } from '../../../components/EtaLeaderboard';
import { SquadChat } from '../../../components/SquadChat';
import { WalkieTalkieControls } from '../../../components/WalkieTalkieControls';
import { ShareModal } from '../../../components/ShareModal';
import { ArrivalCelebration } from '../../../components/ArrivalCelebration';
import {
  Share2,
  MessageSquare,
  Pause,
  Play,
  Car,
  Compass,
  Loader2,
  Wifi,
  WifiOff,
  Battery,
} from 'lucide-react';

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
      // Not registered for this room yet, redirect to join page
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
      // Update self in local state immediately for instant feedback
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

  // Handle Pause Toggle
  const handleTogglePause = () => {
    localTogglePause();
    socketTogglePause(!isPaused);
  };

  // Handle Send Chat
  const handleSendMessage = (text: string, isQuickReply: boolean) => {
    socketSendChat(text, isQuickReply);
  };

  if (initialLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#090d16] text-white">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm font-semibold text-gray-400">Connecting to SquadMap Session...</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#090d16] flex flex-col">
      {/* Top Floating Glass Navigation Header */}
      <header className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
        {/* Left: Trip Info & Status */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <div className="glass-panel-elevated px-3.5 py-2 rounded-2xl flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-indigo-400" />
              <div>
                <h1 className="font-extrabold text-sm text-white tracking-tight leading-tight truncate max-w-[140px] sm:max-w-xs">
                  {session?.name || 'Road Trip'}
                </h1>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-400">
                  <span>ROOM:</span>
                  <span className="font-bold text-indigo-400">{sessionCode}</span>
                </div>
              </div>
            </div>

            {/* Live WebSocket Indicator */}
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              {isConnected ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="hidden sm:inline">LIVE</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-rose-400" />
                  <span className="hidden sm:inline">CONNECTING</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions (Walkie-Talkie, GPS Status, Chat & Share) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* WebRTC Walkie-Talkie Controls */}
          <WalkieTalkieControls
            isMicReady={walkieTalkie.isMicReady}
            isTalking={walkieTalkie.isTalking}
            activeSpeaker={walkieTalkie.activeSpeaker}
            onEnableMic={walkieTalkie.enableMicrophone}
            onStartTalking={walkieTalkie.startTalking}
            onStopTalking={walkieTalkie.stopTalking}
          />

          {/* Adaptive GPS Ping Interval Badge */}
          <div className="hidden md:flex glass-panel px-2.5 py-1.5 rounded-xl items-center gap-1.5 text-xs text-gray-300">
            <Battery className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-medium font-mono">{mode} ({intervalSeconds}s)</span>
          </div>

          {/* Simulator Toggle (Desktop testing / demo) */}
          <button
            onClick={() => {
              if (isSimulating) stopSimulation();
              else startSimulation();
            }}
            title={isSimulating ? 'Stop drive simulation' : 'Simulate drive along route'}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg border transition-all ${
              isSimulating
                ? 'bg-cyan-600 text-white border-cyan-400 shadow-cyan-600/40 animate-pulse'
                : 'glass-panel text-gray-300 hover:text-white border-white/10 hover:border-white/20'
            }`}
          >
            <Car className="w-4 h-4" />
            <span className="hidden sm:inline">{isSimulating ? 'SIMULATING...' : 'SIMULATE'}</span>
          </button>

          {/* Privacy Pause GPS Toggle */}
          <button
            onClick={handleTogglePause}
            title={isPaused ? 'Resume GPS sharing' : 'Pause GPS sharing'}
            className={`p-2.5 rounded-xl border transition-all ${
              isPaused
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'glass-panel text-gray-400 hover:text-white border-white/10'
            }`}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

          {/* Squad Chat Button */}
          <button
            onClick={() => {
              setIsChatOpen(!isChatOpen);
              setUnreadChatCount(0);
            }}
            className="relative glass-panel p-2.5 rounded-xl text-gray-300 hover:text-white border border-white/10 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Invite Squad Button */}
          <button
            onClick={() => setIsShareOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-transform active:scale-95 border border-indigo-400/30"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">INVITE</span>
          </button>
        </div>
      </header>

      {/* Main Map Engine */}
      <div className="flex-1 w-full h-full">
        <MapComponent
          currentUserId={userId}
          destinationLat={session?.destinationLat}
          destinationLng={session?.destinationLng}
          destinationName={session?.destinationName}
          participants={participants}
          etas={etas}
        />
      </div>

      {/* Bottom Left Floating ETA Leaderboard */}
      <div className="absolute bottom-6 left-4 z-20 w-[92%] sm:w-auto">
        <EtaLeaderboard
          destinationName={session?.destinationName}
          participants={participants}
          etas={etas}
          currentUserId={userId}
        />
      </div>

      {/* Road Chat Overlay */}
      <SquadChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        currentUserId={userId}
        onSendMessage={handleSendMessage}
      />

      {/* QR Code & Share Modal */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        sessionCode={sessionCode}
        tripName={session?.name || 'Road Trip'}
      />

      {/* Geofence Arrival Celebration */}
      <ArrivalCelebration
        arrival={latestArrival}
        onDismiss={() => setLatestArrival(null)}
      />
    </div>
  );
}
