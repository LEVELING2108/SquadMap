"use client";

import { use, useState, useEffect } from "react";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import {
  MapPin,
  Compass,
  Users,
  Copy,
  Share2,
  CheckCircle2,
  MessageSquare,
  ChevronUp,
  ChevronDown,
  X,
  Mountain,
  Navigation
} from "lucide-react";
import { toast } from "sonner";

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

  // Request client GPS location & stream to backend
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords({ lat, lng });

        if (myParticipantId) {
          updateLocationMutation.mutate({
            participantId: myParticipantId,
            lat,
            lng,
            speed: pos.coords.speed || undefined,
            accuracy: pos.coords.accuracy || undefined,
          });
        }
      },
      (err) => console.log("GPS watch error:", err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [myParticipantId]);

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
                Live GPS Active
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
            className="p-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Invite Squad</span>
          </button>
        </div>
      </header>

      {/* Main Interactive Map Viewport */}
      <div className="flex-1 w-full h-full relative bg-stone-100 flex items-center justify-center">
        <MapComponent
          destination={{
            name: session.destinationName,
            lat: session.destinationLat,
            lng: session.destinationLng,
          }}
          participants={session.participants}
          userCoords={userCoords}
        />


        {/* Floating Action Controls */}
        <div className="absolute bottom-28 left-4 right-4 z-20 max-w-4xl mx-auto flex items-center justify-between pointer-events-none">
          <button
            onClick={() => setChatOpen(true)}
            className="pointer-events-auto bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 p-3 rounded-2xl shadow-md flex items-center gap-2 text-xs font-semibold transition-transform active:scale-95 cursor-pointer"
          >
            <MessageSquare className="w-5 h-5 text-emerald-800" />
            <span>Squad Chat</span>
            {session.messages.length > 0 && (
              <span className="bg-emerald-800 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {session.messages.length}
              </span>
            )}
          </button>

          <button
            onClick={() => toast.success("Map view centered on squad")}
            className="pointer-events-auto bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 p-3 rounded-2xl shadow-md transition-transform active:scale-95 cursor-pointer"
            title="Recenter Map"
          >
            <Navigation className="w-5 h-5 text-emerald-800" />
          </button>
        </div>
      </div>

      {/* Draggable Bottom Sheet: Travelers & ETAs */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 bg-white/95 border-t border-slate-200 rounded-t-3xl shadow-xl transition-all duration-300 max-w-4xl mx-auto ${
          bottomSheetExpanded ? "h-[65vh]" : "h-24"
        }`}
      >
        {/* Handle Bar Header */}
        <div
          onClick={() => setBottomSheetExpanded(!bottomSheetExpanded)}
          className="p-3.5 flex items-center justify-between cursor-pointer border-b border-slate-100"
        >
          <div className="flex items-center gap-2">
            <Mountain className="w-4 h-4 text-emerald-800" />
            <span className="text-xs font-bold text-slate-900">
              Live Travelers ({session.participants.length})
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
            <span>{bottomSheetExpanded ? "Collapse List" : "Expand ETA List"}</span>
            {bottomSheetExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </div>
        </div>

        {/* Travelers ETA Cards */}
        <div className="p-4 overflow-y-auto h-[calc(100%-52px)] space-y-3">
          {session.participants.map((p) => {
            const dist = userCoords
              ? calculateDistance(userCoords.lat, userCoords.lng, session.destinationLat, session.destinationLng)
              : "2.4";

            return (
              <div
                key={p.id}
                className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex items-center justify-between hover:border-emerald-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-xs"
                    style={{ backgroundColor: p.color || "#059669" }}
                  >
                    {p.displayName.charAt(0).toUpperCase()}
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
                      <span className="text-emerald-700 font-medium">Live GPS</span>
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
