"use client";

import { useState } from "react";


import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { MapPin, Compass, Users, ArrowRight, ShieldCheck, Mountain } from "lucide-react";
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

  // Live search suggestions state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);


  const handleDestinationChange = (val: string) => {
    setDestination(val);
    if (val.trim().length > 2) {
      setIsSearching(true);
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val.trim())}&limit=5`
      )
        .then((res) => res.json())
        .then((data) => {
          setSuggestions(Array.isArray(data) ? data : []);
          setIsSearching(false);
        })
        .catch(() => {
          setIsSearching(false);
        });
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (s: any) => {
    setDestination(s.display_name);
    setLat(parseFloat(s.lat));
    setLng(parseFloat(s.lon));
    setSuggestions([]);
    toast.success("Destination coordinates updated!");
  };


  // Join Session state
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");

  const createSessionMutation = useMutation(trpc.session.createSession.mutationOptions({
    onSuccess: (data) => {
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

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostName.trim()) {
      toast.error("Please enter your display name");
      return;
    }
    if (!destination.trim()) {
      toast.error("Please enter your trip destination");
      return;
    }

    setLocLoading(true);
    let targetLat = lat;
    let targetLng = lng;

    // Automatically lookup real-world coordinates for typed destination name
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination.trim())}&limit=1`
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data[0]) {
          targetLat = parseFloat(data[0].lat);
          targetLng = parseFloat(data[0].lon);
        }
      }
    } catch {
      // Fall back to default/GPS coordinates if network lookup fails
    }

    setLocLoading(false);

    createSessionMutation.mutate({
      hostDisplayName: hostName.trim(),
      destinationName: destination.trim(),
      destinationLat: targetLat,
      destinationLng: targetLng,
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
    <main className="min-h-screen bg-stone-50 text-slate-900 flex flex-col justify-between p-4 sm:p-8 font-sans relative overflow-hidden">
      {/* Traveler Mountain Contour Background Art */}
      <div className="absolute inset-0 opacity-10 pointer-events-none flex items-end justify-center overflow-hidden">
        <svg viewBox="0 0 1440 320" className="w-full h-80 fill-slate-900 preserve-3d">
          <path d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,250.7C960,235,1056,181,1152,165.3C1248,149,1344,171,1392,181.3L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
      </div>

      {/* Top Header */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between py-4 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-800 flex items-center justify-center text-white shadow-sm">
            <Compass className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            SquadMap
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>No Sign-up Required</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto py-8 z-10 items-center">
        {/* Left Intro Text */}
        <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100/70 border border-emerald-200 text-emerald-900 text-xs font-semibold">
            <Mountain className="w-3.5 h-3.5 text-emerald-700" />
            <span>Group Travel & Convoy Location Tracker</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
            Track your squad on <span className="text-emerald-800 underline decoration-emerald-300 decoration-wavy">one shared map</span>.
          </h1>

          <p className="text-slate-600 text-base sm:text-lg leading-relaxed max-w-lg mx-auto lg:mx-0">
            Heading on a road trip, mountain trek, or group meet? Create a live map room in seconds and share your trip link with friends.
          </p>

          {/* Minimal Key Feature Badges */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 max-w-md mx-auto lg:mx-0">
            <div>
              <div className="text-lg font-bold text-slate-900">Live GPS</div>
              <div className="text-xs text-slate-500">Real-time positions</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">Live ETA</div>
              <div className="text-xs text-slate-500">Distance & arrival</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">12h Rooms</div>
              <div className="text-xs text-slate-500">Auto-expiring links</div>
            </div>
          </div>
        </div>

        {/* Right Form Cards (White theme, minimal & elegant) */}
        <div className="lg:col-span-6 space-y-5">
          {/* Create Trip Form */}
          <div className="bg-white border border-slate-200 p-6 sm:p-7 rounded-3xl shadow-sm space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Start a Trip Room</h2>
                <p className="text-xs text-slate-500">Set a destination and invite your group</p>
              </div>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Your Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex (Trip Host)"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                  required
                />
              </div>

              <div className="relative">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Name</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 z-10" />
                  <input
                    type="text"
                    placeholder="e.g. Manali / Baga Beach / Mumbai"
                    value={destination}
                    onChange={(e) => handleDestinationChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                    required
                  />
                </div>

                {/* Suggestions Dropdown */}
                {suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                    {suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectSuggestion(s)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-emerald-50 text-xs border-b border-slate-100 last:border-0 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span className="text-slate-800 line-clamp-1 font-medium">{s.display_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>


              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Destination Lat</label>
                  <input
                    type="number"
                    step="any"
                    value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-700 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Destination Lng</label>
                  <input
                    type="number"
                    step="any"
                    value={lng}
                    onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-700 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={locLoading}
                  className="text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{locLoading ? "Locating..." : "Use Current GPS Location"}</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={createSessionMutation.isPending}
                className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-semibold py-3 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{createSessionMutation.isPending ? "Creating Room..." : "Create Trip Room"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Join Room Form */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-emerald-800" />
              <h3 className="text-sm font-semibold text-slate-900">Have a Trip Code?</h3>
            </div>
            <form onSubmit={handleJoinSession} className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. ABC-123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={7}
                className="w-1/3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-center uppercase tracking-widest text-emerald-800 font-bold placeholder-slate-400 focus:outline-none focus:border-emerald-600"
                required
              />
              <input
                type="text"
                placeholder="Your Name"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
                required
              />
              <button
                type="submit"
                disabled={joinSessionMutation.isPending}
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-4 py-2 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Join
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full text-center text-slate-400 text-xs py-4 border-t border-slate-200 z-10">
        SquadMap © 2026 — Real-Time Group Location Sharing for Travelers
      </footer>
    </main>
  );
}
