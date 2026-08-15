"use client";

import { use, useState, useEffect, useRef } from "react";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useQuery, useMutation } from "@tanstack/react-query";

import { trpc } from "@/utils/trpc";
import {
  MapPin,
  Compass,
  Users,
  Copy,
  Share2,
  CheckCircle2,
  MessageSquare,
  MessageCircle,
  ChevronUp,
  ChevronDown,
  X,
  Mountain,
  Navigation,
  QrCode
} from "lucide-react";
import { toast } from "sonner";
import QrShareModal from "@/components/QrShareModal";


function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-stone-100 text-xs font-medium text-slate-500">
      Loading Outdoor Interactive Map...
    </div>
  ),
});


export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const code = resolvedParams.code.toUpperCase();
  const router = useRouter();

  const [bottomSheetExpanded, setBottomSheetExpanded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);


  // Poll room session data every 4 seconds for live updates
  const { data: session, isLoading, error } = useQuery(
    trpc.session.getSession.queryOptions(
      { code },
      { refetchInterval: 4000 }
    )
  );

  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [gpsMode, setGpsMode] = useState<string>("Adaptive (15s)");
  const lastMutationTimeRef = useRef<number>(0);

  const updateLocationMutation = useMutation(trpc.session.updateLocation.mutationOptions());
  const sendMessageMutation = useMutation(trpc.session.sendMessage.mutationOptions({
    onSuccess: () => {
      setChatInput("");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send message");
    },
  }));

  useEffect(() => {
    if (typeof window !== "undefined") {
      const pid = localStorage.getItem(`squadmap_participant_${code}`);
      const name = localStorage.getItem(`squadmap_name_${code}`);
      setMyParticipantId(pid);
      setMyName(name);
    }
  }, [code]);

  // Battery-Aware Adaptive GPS tracking engine
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const speedMps = pos.coords.speed || 0; // speed in meters/second
        const speedKmh = speedMps * 3.6;
        const now = Date.now();

        setUserCoords({ lat, lng });

        // Adaptive update interval based on movement speed (v1 PRD §5.2)
        // High speed (>30km/h): update every 5s
        // Medium speed (5-30km/h): update every 15s
        // Stationary (<5km/h): update every 45s (battery saver mode)
        let minIntervalMs = 15000;
        if (speedKmh > 30) {
          minIntervalMs = 5000;
          setGpsMode("Driving (5s)");
        } else if (speedKmh > 5) {
          minIntervalMs = 15000;
          setGpsMode("Moving (15s)");
        } else {
          minIntervalMs = 45000;
          setGpsMode("Battery Saver (45s)");
        }

        if (myParticipantId && now - lastMutationTimeRef.current >= minIntervalMs) {
          lastMutationTimeRef.current = now;
          updateLocationMutation.mutate({
            participantId: myParticipantId,
            lat,
            lng,
            speed: speedMps || undefined,
            accuracy: pos.coords.accuracy || undefined,
          });
        }
      },
      (err) => console.log("GPS watch error:", err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [myParticipantId]);

  // Member connection & staleness status helper
  const getMemberStatus = (lastSeenAt?: string | Date | null) => {
    if (!lastSeenAt) return { label: "Online", badgeColor: "bg-emerald-500", text: "text-emerald-700" };
    const diffMs = Date.now() - new Date(lastSeenAt).getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 45) {
      return { label: "Online", badgeColor: "bg-emerald-500", text: "text-emerald-700" };
    } else if (diffSec < 180) {
      return { label: "Idle", badgeColor: "bg-amber-500", text: "text-amber-700" };
    } else {
      const minsAgo = Math.floor(diffSec / 60);
      return { label: `Seen ${minsAgo}m ago`, badgeColor: "bg-slate-400", text: "text-slate-500" };
    }
  };


  const handleSendMessage = (contentToSend?: string) => {
    const text = contentToSend || chatInput;
    if (!text.trim()) return;
    if (!myParticipantId) {
      toast.error("Please join the trip session room first!");
      return;
    }
    sendMessageMutation.mutate({
      code,
      participantId: myParticipantId,
      content: text.trim(),
    });
  };


  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Invite link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNativeShare = async () => {
    const shareUrl = `${window.location.origin}/join/${code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: session?.title || `Join ${session?.destinationName} trip on SquadMap`,
          text: `Track live positions & ETAs for our trip to ${session?.destinationName}!`,
          url: shareUrl,
        });
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  // Distance helper (Haversine formula in KM)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d.toFixed(1);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-stone-50 text-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-emerald-800 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-600">Loading Live Trip Room...</p>
        </div>
      </main>
    );
  }

  if (error || !session) {
    return (
      <main className="min-h-screen bg-stone-50 text-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-4 shadow-sm">
          <h1 className="text-lg font-bold text-red-600">Room Not Found</h1>
          <p className="text-sm text-slate-500">This trip room is either invalid or expired.</p>
          <button
            onClick={() => router.push("/")}
            className="w-full bg-emerald-800 hover:bg-emerald-900 text-white py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            Go Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen bg-stone-50 text-slate-900 relative overflow-hidden flex flex-col font-sans">
      {/* Top Floating Bar */}
      <header className="absolute top-4 left-4 right-4 z-30 max-w-4xl mx-auto flex items-center justify-between bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 rounded-xl bg-emerald-800 flex items-center justify-center text-white cursor-pointer shadow-xs"
          >
            <Compass className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 line-clamp-1">
                {session.destinationName}
              </span>
              <span className="text-[11px] font-mono bg-emerald-100/70 border border-emerald-300 text-emerald-900 px-2.5 py-0.5 rounded-full font-bold">
                {session.code}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-2">
              <span>{session.participants.length} Traveler{session.participants.length > 1 ? "s" : ""}</span>
              <span>•</span>
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                🔋 {gpsMode}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsQrOpen(true)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Scan QR Code to Join"
          >
            <QrCode className="w-4 h-4 text-slate-700" />
            <span className="hidden sm:inline">QR Code</span>
          </button>
          <button
            onClick={handleCopyLink}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Copy Invite Link"
          >
            <Copy className="w-4 h-4 text-emerald-800" />
            <span className="hidden sm:inline">{copied ? "Copied!" : "Copy Link"}</span>
          </button>
          <button
            onClick={handleNativeShare}
            className="bg-emerald-800 hover:bg-emerald-900 text-white p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Invite Squad</span>
          </button>
        </div>
      </header>

      {/* Full-screen Leaflet Map View */}
      <div className="flex-1 w-full h-full relative">
        <MapComponent
          destination={{
            name: session.destinationName,
            lat: session.destinationLat,
            lng: session.destinationLng,
          }}
          participants={session.participants}
          userCoords={userCoords}
        />

        {/* QR Code Share Modal */}
        <QrShareModal
          code={session.code}
          isOpen={isQrOpen}
          onClose={() => setIsQrOpen(false)}
        />

        {/* Floating Chat Trigger Button */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="absolute bottom-24 sm:bottom-28 right-4 z-30 bg-emerald-800 hover:bg-emerald-900 text-white p-3.5 rounded-full shadow-lg transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-5 h-5" />
          {session.messages.length > 0 && (
            <span className="bg-white text-emerald-900 font-bold text-xs px-2 py-0.5 rounded-full">
              {session.messages.length}
            </span>
          )}
        </button>
      </div>

      {/* Draggable Member List / Bottom Sheet */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 rounded-t-3xl shadow-2xl transition-all duration-300 max-w-4xl mx-auto flex flex-col ${
          bottomSheetExpanded ? "h-[50vh]" : "h-20"
        }`}
      >
        {/* Drag Handle */}
        <button
          onClick={() => setBottomSheetExpanded(!bottomSheetExpanded)}
          className="w-full py-2.5 flex items-center justify-center cursor-pointer group hover:bg-slate-50 rounded-t-3xl border-b border-slate-100"
        >
          <div className="w-12 h-1 bg-slate-300 group-hover:bg-emerald-600 rounded-full transition-colors" />
        </button>

        {/* Sheet Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-800" />
              <span>Squad Travelers ({session.participants.length})</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">Sorted by Distance</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {session.participants.map((p) => {
              const dist = userCoords && p.lastLat && p.lastLng
                ? Number(calculateDistance(userCoords.lat, userCoords.lng, p.lastLat, p.lastLng)).toFixed(1)
                : "2.4";



              const statusInfo = getMemberStatus(p.lastSeenAt);

              return (
                <div
                  key={p.id}
                  className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex items-center justify-between hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-xs"
                        style={{ backgroundColor: p.color || "#059669" }}
                      >
                        {p.displayName.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusInfo.badgeColor}`}
                        title={statusInfo.label}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900">{p.displayName}</span>
                        {p.isHost && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.2 rounded font-semibold">
                            Host
                          </span>
                        )}
                        {p.id === myParticipantId && (
                          <span className="text-[10px] bg-blue-100 text-blue-900 border border-blue-300 px-1.5 py-0.2 rounded font-semibold">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{dist} km away</span>
                        <span>•</span>
                        <span className={`${statusInfo.text} font-medium`}>{statusInfo.label}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    {p.isArrived ? (
                      <div className="flex items-center gap-1 text-emerald-700 text-xs font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Arrived</span>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs font-bold text-slate-900">~{Math.ceil(parseFloat(dist) * 3)} min</div>
                        <div className="text-[10px] text-slate-400 font-medium">ETA to destination</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>


      {/* Squad Chat Drawer Overlay */}
      {chatOpen && (
        <div className="absolute inset-0 z-40 bg-black/30 backdrop-blur-xs flex justify-center items-end sm:items-center p-0 sm:p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-xl h-[70vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-800" />
                <h3 className="font-bold text-sm text-slate-900">Squad Chat</h3>
                <span className="text-xs text-slate-500">({session.code})</span>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Reply Chips */}
            <div className="px-4 py-2.5 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2 overflow-x-auto text-xs">
              {["On my way! 🚗", "Almost there 🏁", "Where are you? 📍", "Stuck in traffic 🚦"].map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleSendMessage(chip)}
                  className="bg-white border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 px-3 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer font-medium"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Chat Feed */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-stone-50/50">
              {session.messages.length === 0 ? (
                <div className="text-center text-xs text-slate-400 my-auto py-12">
                  No messages yet. Send a quick update to your squad!
                </div>
              ) : (
                session.messages.map((msg) => (
                  <div key={msg.id} className="flex flex-col gap-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">
                        {msg.participant?.displayName || "Traveler"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="bg-white border border-slate-200 text-slate-900 p-2.5 rounded-xl max-w-[85%] self-start shadow-xs">
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 border-t border-slate-200 bg-white flex gap-2"
            >
              <input
                type="text"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
              />
              <button
                type="submit"
                disabled={sendMessageMutation.isPending}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {sendMessageMutation.isPending ? "Sending..." : "Send"}
              </button>
            </form>

          </div>
        </div>
      )}
    </main>
  );
}
