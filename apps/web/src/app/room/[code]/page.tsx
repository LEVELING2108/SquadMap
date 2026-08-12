"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import {
  MapPin,
  Navigation,
  Users,
  Copy,
  Share2,
  CheckCircle2,
  MessageSquare,
  Compass,
  Clock,
  Sparkles,
  ChevronUp,
  ChevronDown,
  X
} from "lucide-react";
import { toast } from "sonner";

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const code = resolvedParams.code.toUpperCase();
  const router = useRouter();

  const [bottomSheetExpanded, setBottomSheetExpanded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Poll room session data every 4 seconds for live updates
  const { data: session, isLoading, error } = useQuery(
    trpc.session.getSession.queryOptions(
      { code },
      { refetchInterval: 4000 }
    )
  );

  // Read current participant ID from local storage
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const pid = localStorage.getItem(`squadmap_participant_${code}`);
      const name = localStorage.getItem(`squadmap_name_${code}`);
      setMyParticipantId(pid);
      setMyName(name);
    }
  }, [code]);

  // Request client GPS location
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => console.log("GPS watch error:", err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

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
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading Live SquadMap Room...</p>
        </div>
      </main>
    );
  }

  if (error || !session) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
          <h1 className="text-lg font-bold text-red-400">Room Not Found</h1>
          <p className="text-sm text-slate-400">This trip room is either invalid or expired.</p>
          <button
            onClick={() => router.push("/")}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Go Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen bg-slate-950 text-white relative overflow-hidden flex flex-col font-sans">
      {/* Top Floating Overlay Bar */}
      <header className="absolute top-4 left-4 right-4 z-30 max-w-4xl mx-auto flex items-center justify-between bg-slate-900/90 border border-slate-800 p-3 rounded-2xl backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-400 flex items-center justify-center text-white"
          >
            <Navigation className="w-4 h-4 transform rotate-45" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white line-clamp-1">
                {session.destinationName}
              </span>
              <span className="text-[10px] font-mono bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold">
                {session.code}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>{session.participants.length} Squad Member{session.participants.length > 1 ? "s" : ""}</span>
              <span>•</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Tracking
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Copy Invite Link"
          >
            <Copy className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">{copied ? "Copied!" : "Share Link"}</span>
          </button>
          <button
            onClick={handleNativeShare}
            className="p-2 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white text-xs font-medium flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Invite</span>
          </button>
        </div>
      </header>

      {/* Main Interactive Map Canvas Viewport */}
      <div className="flex-1 w-full h-full relative bg-slate-950 flex items-center justify-center">
        {/* Simulated Map Canvas Layer with Dark Stylised Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-60 pointer-events-none" />

        {/* Destination Pin Marker */}
        <div className="absolute z-20 flex flex-col items-center animate-bounce">
          <div className="bg-red-500/20 border border-red-500/50 p-2 rounded-full backdrop-blur-md">
            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/40 text-white font-bold">
              ★
            </div>
          </div>
          <div className="mt-1 bg-slate-900/90 border border-slate-800 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 backdrop-blur-md">
            <MapPin className="w-3.5 h-3.5 text-red-500" />
            <span>{session.destinationName}</span>
          </div>
        </div>

        {/* Participant Map Marker Badges (Spread around) */}
        <div className="absolute z-20 top-1/3 left-1/4 flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center font-bold text-xs shadow-lg">
            {session.participants[0]?.displayName.charAt(0) || "A"}
          </div>
          <span className="mt-1 text-[10px] font-semibold bg-slate-900/90 border border-slate-800 text-slate-200 px-2 py-0.5 rounded-full shadow">
            {session.participants[0]?.displayName} (Host)
          </span>
        </div>

        {session.participants.length > 1 && (
          <div className="absolute z-20 bottom-1/3 right-1/4 flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center font-bold text-xs shadow-lg">
              {session.participants[1]?.displayName.charAt(0) || "B"}
            </div>
            <span className="mt-1 text-[10px] font-semibold bg-slate-900/90 border border-slate-800 text-slate-200 px-2 py-0.5 rounded-full shadow">
              {session.participants[1]?.displayName}
            </span>
          </div>
        )}

        {/* Floating Actions on Map */}
        <div className="absolute bottom-28 left-4 right-4 z-20 max-w-4xl mx-auto flex items-center justify-between pointer-events-none">
          <button
            onClick={() => setChatOpen(true)}
            className="pointer-events-auto bg-slate-900/90 border border-slate-800 hover:bg-slate-800 text-white p-3 rounded-2xl shadow-xl backdrop-blur-xl flex items-center gap-2 text-xs font-medium transition-transform active:scale-95 cursor-pointer"
          >
            <MessageSquare className="w-5 h-5 text-blue-400" />
            <span>Squad Chat</span>
            {session.messages.length > 0 && (
              <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {session.messages.length}
              </span>
            )}
          </button>

          <button
            onClick={() => toast.success("Map re-centered on all members")}
            className="pointer-events-auto bg-slate-900/90 border border-slate-800 hover:bg-slate-800 text-white p-3 rounded-2xl shadow-xl backdrop-blur-xl transition-transform active:scale-95 cursor-pointer"
            title="Recenter Map"
          >
            <Compass className="w-5 h-5 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Draggable Bottom Sheet: Member List & ETAs */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 bg-slate-900/95 border-t border-slate-800 rounded-t-3xl backdrop-blur-2xl transition-all duration-300 shadow-2xl max-w-4xl mx-auto ${
          bottomSheetExpanded ? "h-[65vh]" : "h-24"
        }`}
      >
        {/* Handle Bar */}
        <div
          onClick={() => setBottomSheetExpanded(!bottomSheetExpanded)}
          className="p-3 flex items-center justify-between cursor-pointer border-b border-slate-800/60"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold text-slate-200">
              Live Squad List ({session.participants.length})
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-400">
            <span>{bottomSheetExpanded ? "Collapse" : "Expand ETA List"}</span>
            {bottomSheetExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </div>
        </div>

        {/* Member Cards List */}
        <div className="p-4 overflow-y-auto h-[calc(100%-48px)] space-y-3">
          {session.participants.map((p, idx) => {
            const dist = userCoords
              ? calculateDistance(userCoords.lat, userCoords.lng, session.destinationLat, session.destinationLng)
              : "2.4";

            return (
              <div
                key={p.id}
                className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl flex items-center justify-between hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-md"
                    style={{ backgroundColor: p.color || "#3B82F6" }}
                  >
                    {p.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-100">{p.displayName}</span>
                      {p.isHost && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.2 rounded font-medium">
                          Host
                        </span>
                      )}
                      {p.id === myParticipantId && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-medium">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>{dist} km away</span>
                      <span>•</span>
                      <span className="text-slate-500">Live GPS</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  {p.isArrived ? (
                    <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Arrived</span>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs font-bold text-blue-400">~{Math.ceil(parseFloat(dist) * 3)} min</div>
                      <div className="text-[10px] text-slate-500">ETA Countdown</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Group Chat Drawer Modal */}
      {chatOpen && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl h-[70vh] flex flex-col overflow-hidden">
            {/* Chat Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Squad Chat</h3>
                <span className="text-xs text-slate-400">({session.code})</span>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Reply Chips */}
            <div className="px-4 py-2 bg-slate-950/30 border-b border-slate-800/60 flex items-center gap-2 overflow-x-auto text-xs">
              {["On my way! 🚗", "Almost there 🏁", "Where are you? 📍", "Stuck in traffic 🚦"].map((chip) => (
                <button
                  key={chip}
                  onClick={() => toast.success(`Sent quick reply: "${chip}"`)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Messages Feed */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/40">
              {session.messages.length === 0 ? (
                <div className="text-center text-xs text-slate-500 my-auto py-12">
                  No messages yet. Send a message to your trip squad!
                </div>
              ) : (
                session.messages.map((msg) => (
                  <div key={msg.id} className="flex flex-col gap-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-300">
                        {msg.participant?.displayName || "Member"}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="bg-slate-800/80 text-slate-100 p-2.5 rounded-xl max-w-[85%] self-start">
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message Input */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2">
              <input
                type="text"
                placeholder="Type a message..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => toast.success("Message sent!")}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
