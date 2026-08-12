"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { MapPin, Navigation, Users, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const router = useRouter();

  // Create Session state
  const [hostName, setHostName] = useState("");
  const [destination, setDestination] = useState("");
  const [title, setTitle] = useState("");
  const [lat, setLat] = useState<number>(15.5497); // Default Goa coords
  const [lng, setLng] = useState<number>(73.7536);
  const [locLoading, setLocLoading] = useState(false);

  // Join Session state
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");

  const createSessionMutation = useMutation(trpc.session.createSession.mutationOptions({
    onSuccess: (data) => {
      // Store host participant ID locally
      if (typeof window !== "undefined") {
        localStorage.setItem(`squadmap_participant_${data.session.code}`, data.participant.id);
        localStorage.setItem(`squadmap_name_${data.session.code}`, data.participant.displayName);
      }
      toast.success(`Trip room created! Code: ${data.session.code}`);
      router.push(`/room/${data.session.code}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create session room");
    },
  }));

  const joinSessionMutation = useMutation(trpc.session.joinSession.mutationOptions({
    onSuccess: (data) => {
      if (typeof window !== "undefined") {
        localStorage.setItem(`squadmap_participant_${data.session.code}`, data.participant.id);
        localStorage.setItem(`squadmap_name_${data.session.code}`, data.participant.displayName);
      }
      toast.success(`Joined room ${data.session.code}!`);
      router.push(`/room/${data.session.code}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to join room");
    },
  }));

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocLoading(false);
        toast.success("Location coordinates updated!");
      },
      (err) => {
        setLocLoading(false);
        toast.error("Could not fetch location: " + err.message);
      }
    );
  };

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostName.trim()) {
      toast.error("Please enter your display name");
      return;
    }
    if (!destination.trim()) {
      toast.error("Please enter your trip destination");
      return;
    }
    createSessionMutation.mutate({
      hostDisplayName: hostName.trim(),
      destinationName: destination.trim(),
      destinationLat: lat,
      destinationLng: lng,
      title: title.trim() || undefined,
    });
  };

  const handleJoinSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      toast.error("Please enter a room code");
      return;
    }
    if (!joinName.trim()) {
      toast.error("Please enter your display name");
      return;
    }
    const cleanCode = joinCode.trim().toUpperCase();
    joinSessionMutation.mutate({
      code: cleanCode,
      displayName: joinName.trim(),
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8 font-sans relative overflow-hidden">
      {/* Background radial gradient decoration */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between py-4 z-10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Navigation className="w-5 h-5 text-white transform rotate-45" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            SquadMap
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-full backdrop-blur-md">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Zero Sign-up Required</span>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto py-8 z-10 items-center">
        {/* Left Column: Intro */}
        <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Real-time Group Trip Tracking</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight text-slate-50">
            See every friend's position on <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">one live map</span>.
          </h1>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-lg mx-auto lg:mx-0">
            Travelling together to a party, beach, or trip? Share a single link to see live locations, ETAs, and arrival badges for your squad.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-900 max-w-md mx-auto lg:mx-0">
            <div>
              <div className="text-xl font-bold text-white">Live GPS</div>
              <div className="text-xs text-slate-500">Sub-second updates</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white">Live ETA</div>
              <div className="text-xs text-slate-500">Distance countdowns</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white">Auto 12h</div>
              <div className="text-xs text-slate-500">Self-expiring rooms</div>
            </div>
          </div>
        </div>

        {/* Right Column: Cards (Start a Trip / Join Room) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Start a Trip Card */}
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-2.5 rounded-lg bg-blue-600/10 text-blue-400">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Start a New Trip Room</h2>
                <p className="text-xs text-slate-400">Create an instant room and share link with friends</p>
              </div>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Your Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex (Host)"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Destination Name</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="e.g. Baga Beach / Resort Gate"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Destination Lat</label>
                  <input
                    type="number"
                    step="any"
                    value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Destination Lng</label>
                  <input
                    type="number"
                    step="any"
                    value={lng}
                    onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={locLoading}
                  className="text-blue-400 hover:text-blue-300 underline flex items-center gap-1 disabled:opacity-50"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{locLoading ? "Locating..." : "Use Current GPS Coords"}</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={createSessionMutation.isPending}
                className="w-full bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-medium py-3 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 cursor-pointer"
              >
                <span>{createSessionMutation.isPending ? "Creating Room..." : "Create Trip Room"}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </div>

          {/* Join Room with Code Card */}
          <div className="bg-slate-900/50 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-md">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-200">Have a 6-Character Room Code?</h3>
            </div>
            <form onSubmit={handleJoinSession} className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. ABC-123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={7}
                className="w-1/3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-center uppercase tracking-widest text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                required
              />
              <input
                type="text"
                placeholder="Your Name"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                required
              />
              <button
                type="submit"
                disabled={joinSessionMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-4 py-2 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Join
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full text-center text-slate-500 text-xs py-4 border-t border-slate-900 z-10">
        SquadMap © 2026 — Real-time Group Location Sharing for Trips & Events
      </footer>
    </main>
  );
}
