'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSession, joinSession } from '../lib/api';
import {
  Compass,
  MapPin,
  Users,
  Radio,
  Zap,
  ArrowRight,
  ShieldCheck,
  BatteryCharging,
  Loader2,
  Navigation,
} from 'lucide-react';

const POPULAR_DESTINATIONS = [
  { name: 'Baga Beach, Goa', lat: 15.5553, lng: 73.7516 },
  { name: 'Marine Drive, Mumbai', lat: 18.9438, lng: 72.8234 },
  { name: 'India Gate, New Delhi', lat: 28.6129, lng: 77.2295 },
  { name: 'Golden Gate Bridge, SF', lat: 37.8199, lng: -122.4783 },
];

const AVATAR_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

export default function HomePage() {
  const router = useRouter();

  // Modals state
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states - Create
  const [tripName, setTripName] = useState('Weekend Roadtrip');
  const [hostName, setHostName] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [destinationName, setDestinationName] = useState('Baga Beach, Goa');
  const [destinationLat, setDestinationLat] = useState(15.5553);
  const [destinationLng, setDestinationLng] = useState(73.7516);

  // Form states - Join
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');

  // Handle Host Trip
  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostName.trim()) {
      setErrorMsg('Please enter your name');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg(null);

      const res = await createSession({
        name: tripName.trim(),
        hostDisplayName: hostName.trim(),
        hostColorHex: selectedColor,
        destinationName: destinationName.trim(),
        destinationLat,
        destinationLng,
      });

      // Store credentials in localStorage for room session
      if (typeof window !== 'undefined') {
        localStorage.setItem(`squad_user_${res.session.code}`, res.hostParticipantId);
        localStorage.setItem(`squad_name_${res.session.code}`, hostName.trim());
        localStorage.setItem(`squad_color_${res.session.code}`, selectedColor);
      }

      router.push(`/room/${res.session.code}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create trip');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Join Trip
  const handleJoinTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || !joinName.trim()) {
      setErrorMsg('Please enter trip code and your name');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg(null);

      const cleanCode = joinCode.trim().toUpperCase();
      const res = await joinSession(cleanCode, {
        displayName: joinName.trim(),
        colorHex: selectedColor,
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem(`squad_user_${cleanCode}`, res.participantId);
        localStorage.setItem(`squad_name_${cleanCode}`, res.displayName);
        localStorage.setItem(`squad_color_${cleanCode}`, res.colorHex);
      }

      router.push(`/room/${cleanCode}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to join trip');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDestinationLat(Number(pos.coords.latitude.toFixed(6)));
          setDestinationLng(Number(pos.coords.longitude.toFixed(6)));
          setDestinationName('My Current Location');
        },
        () => setErrorMsg('Unable to retrieve current location')
      );
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-between p-4 sm:p-8 bg-gradient-to-b from-[#0B0F19] via-[#0E1526] to-[#070A12] relative overflow-hidden">
      {/* Background glowing ambient orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="relative z-10 max-w-6xl mx-auto w-full flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Compass className="w-5 h-5 text-white animate-spin-slow" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl tracking-tight text-white flex items-center gap-1.5">
              SquadMap <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-mono font-bold border border-indigo-500/30">v2.0</span>
            </h1>
            <p className="text-[11px] text-gray-400">Live Road-Trip Coordination</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            No Account Required
          </span>
        </div>
      </header>

      {/* Main Content Hero */}
      <div className="relative z-10 max-w-6xl mx-auto w-full my-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Col: Tagline & Features */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>MapLibre GL Vector Maps + WebRTC Voice Walkie-Talkie</span>
          </div>

          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-[1.15]">
            Live Squad Tracking & <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400">Driving ETAs</span> for Every Convoy
          </h2>

          <p className="text-base sm:text-lg text-gray-300 max-w-xl font-normal leading-relaxed">
            See your entire road trip squad on one shared GPU-accelerated vector map. Track live driving road routes, get automatic arrival countdowns, and talk over push-to-talk voice — with zero friction.
          </p>

          {/* Quick Feature Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-gray-900/60 border border-white/5">
              <Navigation className="w-5 h-5 text-cyan-400 mb-1" />
              <h4 className="text-xs font-bold text-white">OSRM Driving Routes</h4>
              <p className="text-[11px] text-gray-400">Real-time road polylines</p>
            </div>
            <div className="p-3 rounded-xl bg-gray-900/60 border border-white/5">
              <Radio className="w-5 h-5 text-indigo-400 mb-1" />
              <h4 className="text-xs font-bold text-white">Voice Walkie-Talkie</h4>
              <p className="text-[11px] text-gray-400">Push-to-talk audio mesh</p>
            </div>
            <div className="p-3 rounded-xl bg-gray-900/60 border border-white/5">
              <BatteryCharging className="w-5 h-5 text-emerald-400 mb-1" />
              <h4 className="text-xs font-bold text-white">Adaptive GPS</h4>
              <p className="text-[11px] text-gray-400">Battery-aware update pings</p>
            </div>
          </div>
        </div>

        {/* Right Col: Host / Join Form Card */}
        <div className="lg:col-span-5">
          <div className="glass-panel-elevated rounded-3xl p-6 sm:p-7 shadow-2xl border border-white/10 relative">
            {/* Tabs */}
            <div className="flex p-1 rounded-2xl bg-gray-900/80 mb-6 border border-white/5">
              <button
                type="button"
                onClick={() => { setActiveTab('create'); setErrorMsg(null); }}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs tracking-wider transition-all ${
                  activeTab === 'create'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                HOST A TRIP
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('join'); setErrorMsg(null); }}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs tracking-wider transition-all ${
                  activeTab === 'join'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                JOIN EXISTING
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            {/* CREATE FORM */}
            {activeTab === 'create' ? (
              <form onSubmit={handleCreateTrip} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Trip / Session Name
                  </label>
                  <input
                    type="text"
                    required
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                    placeholder="e.g. Goa Convoy 🚗"
                    className="w-full bg-gray-900/80 text-white text-sm rounded-xl px-3.5 py-2.5 border border-white/10 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Your Name (Host)
                  </label>
                  <input
                    type="text"
                    required
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    placeholder="e.g. Alex"
                    className="w-full bg-gray-900/80 text-white text-sm rounded-xl px-3.5 py-2.5 border border-white/10 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Color Picker */}
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Marker Color
                  </label>
                  <div className="flex gap-2 items-center overflow-x-auto pb-1">
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={`w-7 h-7 rounded-full shrink-0 transition-transform ${
                          selectedColor === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#0B0F19]' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Destination */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                      Destination Pin
                    </label>
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                      Use My GPS
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={destinationName}
                    onChange={(e) => setDestinationName(e.target.value)}
                    placeholder="e.g. Baga Beach, Goa"
                    className="w-full bg-gray-900/80 text-white text-sm rounded-xl px-3.5 py-2.5 border border-white/10 focus:outline-none focus:border-indigo-500 mb-2"
                  />

                  {/* Preset Quick Destination Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_DESTINATIONS.map((dest) => (
                      <button
                        key={dest.name}
                        type="button"
                        onClick={() => {
                          setDestinationName(dest.name);
                          setDestinationLat(dest.lat);
                          setDestinationLng(dest.lng);
                        }}
                        className="text-[10px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5"
                      >
                        {dest.name}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>LAUNCH TRIP ROOM</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* JOIN FORM */
              <form onSubmit={handleJoinTrip} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    6-Character Trip Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. 7K4X9B"
                    className="w-full bg-gray-900/80 text-white text-lg font-mono font-bold tracking-widest uppercase rounded-xl px-3.5 py-2.5 border border-white/10 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="e.g. Jordan"
                    className="w-full bg-gray-900/80 text-white text-sm rounded-xl px-3.5 py-2.5 border border-white/10 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Color Picker */}
                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Marker Color
                  </label>
                  <div className="flex gap-2 items-center overflow-x-auto pb-1">
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={`w-7 h-7 rounded-full shrink-0 transition-transform ${
                          selectedColor === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#0B0F19]' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>JOIN SQUAD ROOM</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto w-full py-4 text-center text-xs text-gray-500 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>SquadMap V2 — Built with Java 22, Spring Boot 3, MapLibre GL & WebRTC</p>
        <p className="text-[11px] text-gray-600">Ephemeral Road Trip Privacy • 12-Hour Session Expiration</p>
      </footer>
    </main>
  );
}
