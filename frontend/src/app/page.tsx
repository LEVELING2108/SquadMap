'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSession, joinSession } from '../lib/api';
import {
  Compass,
  MapPin,
  Users,
  Radio,
  Navigation,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Sparkles,
} from 'lucide-react';

const POPULAR_DESTINATIONS = [
  { name: 'Baga Beach, Goa', lat: 15.5553, lng: 73.7516, icon: '🏖️' },
  { name: 'Marine Drive, Mumbai', lat: 18.9438, lng: 72.8234, icon: '🏙️' },
  { name: 'India Gate, New Delhi', lat: 28.6129, lng: 77.2295, icon: '🏛️' },
  { name: 'Golden Gate Bridge, SF', lat: 37.8199, lng: -122.4783, icon: '🌉' },
];

const AVATAR_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

export default function HomePage() {
  const router = useRouter();

  // Active Tab: 'create' | 'join'
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

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
  };

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
      triggerHaptic();

      const res = await createSession({
        name: tripName.trim(),
        hostDisplayName: hostName.trim(),
        hostColorHex: selectedColor,
        destinationName: destinationName.trim(),
        destinationLat,
        destinationLng,
      });

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
      triggerHaptic();

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
    triggerHaptic();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDestinationLat(Number(pos.coords.latitude.toFixed(6)));
          setDestinationLng(Number(pos.coords.longitude.toFixed(6)));
          setDestinationName('My GPS Location');
        },
        () => setErrorMsg('Unable to retrieve current location')
      );
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-gradient-to-b from-[#090D18] via-[#0D1424] to-[#080B14] flex flex-col justify-between p-4 sm:p-6 pt-safe pb-safe no-scrollbar">
      {/* Top Header */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-black text-lg text-white tracking-tight flex items-center gap-1.5">
              SquadMap
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-mono font-bold border border-indigo-500/30">
                v2.0
              </span>
            </h1>
            <p className="text-[11px] text-gray-400">Road Trip Convoy App</p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-emerald-400 font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          Zero Signup
        </span>
      </header>

      {/* Main Container */}
      <div className="max-w-md mx-auto w-full my-auto space-y-4">
        {/* iOS-Style Segmented Tab Switcher */}
        <div className="p-1 rounded-2xl bg-gray-900/90 border border-white/10 flex shadow-lg">
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setActiveTab('create');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs tracking-wider transition-all active-press ${
              activeTab === 'create'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            HOST CONVOY
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setActiveTab('join');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs tracking-wider transition-all active-press ${
              activeTab === 'join'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            JOIN CONVOY
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Card Form */}
        <div className="glass-panel-elevated rounded-3xl p-5 sm:p-6 border border-white/10 shadow-2xl">
          {activeTab === 'create' ? (
            /* CREATE CONVOY FORM */
            <form onSubmit={handleCreateTrip} className="space-y-4">
              <div>
                <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">
                  Trip Name
                </label>
                <input
                  type="text"
                  required
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  placeholder="e.g. Goa Convoy 🚗"
                  className="w-full bg-gray-900/90 text-white text-sm rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">
                  Your Display Name (Driver / Host)
                </label>
                <input
                  type="text"
                  required
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="e.g. Captain Alex"
                  className="w-full bg-gray-900/90 text-white text-sm rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Avatar Color Picker */}
              <div>
                <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1.5">
                  Vehicle / Avatar Color
                </label>
                <div className="flex gap-2.5 items-center overflow-x-auto pb-1 no-scrollbar">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setSelectedColor(c);
                      }}
                      className={`w-8 h-8 rounded-full shrink-0 transition-transform active-press ${
                        selectedColor === c
                          ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#0B0F19]'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Destination */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block">
                    Destination Pin
                  </label>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="text-[11px] text-cyan-400 font-bold active-press"
                  >
                    📍 Use My GPS
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={destinationName}
                  onChange={(e) => setDestinationName(e.target.value)}
                  placeholder="e.g. Baga Beach, Goa"
                  className="w-full bg-gray-900/90 text-white text-sm rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-indigo-500 mb-2.5 transition-colors"
                />

                {/* Destination Chips */}
                <div className="grid grid-cols-2 gap-1.5">
                  {POPULAR_DESTINATIONS.map((dest) => (
                    <button
                      key={dest.name}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setDestinationName(dest.name);
                        setDestinationLat(dest.lat);
                        setDestinationLng(dest.lng);
                      }}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-semibold border border-white/5 truncate text-left active-press flex items-center gap-1.5"
                    >
                      <span>{dest.icon}</span>
                      <span className="truncate">{dest.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Launch CTA */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 text-white font-extrabold text-sm tracking-wider shadow-2xl shadow-indigo-600/50 flex items-center justify-center gap-2 active-press disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>LAUNCH CONVOY</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* JOIN CONVOY FORM */
            <form onSubmit={handleJoinTrip} className="space-y-4">
              <div>
                <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">
                  6-Character Convoy Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  autoFocus
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. NQZY5V"
                  className="w-full bg-gray-900/90 text-white text-xl font-mono font-black tracking-widest uppercase rounded-xl px-4 py-3.5 border border-white/10 focus:outline-none focus:border-indigo-500 text-center"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1">
                  Your Display Name
                </label>
                <input
                  type="text"
                  required
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="e.g. Jordan"
                  className="w-full bg-gray-900/90 text-white text-sm rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Avatar Color Picker */}
              <div>
                <label className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1.5">
                  Avatar Color
                </label>
                <div className="flex gap-2.5 items-center overflow-x-auto pb-1 no-scrollbar">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setSelectedColor(c);
                      }}
                      className={`w-8 h-8 rounded-full shrink-0 transition-transform active-press ${
                        selectedColor === c
                          ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#0B0F19]'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Join CTA */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 text-white font-extrabold text-sm tracking-wider shadow-2xl shadow-indigo-600/50 flex items-center justify-center gap-2 active-press disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>ENTER CONVOY</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Quick App Highlights Footer */}
        <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-gray-400">
          <div className="p-2 rounded-xl bg-white/5 border border-white/5">
            <span className="block font-bold text-white mb-0.5">3D Vector Map</span>
            <span>GPU Powered</span>
          </div>
          <div className="p-2 rounded-xl bg-white/5 border border-white/5">
            <span className="block font-bold text-white mb-0.5">Walkie-Talkie</span>
            <span>Push-To-Talk</span>
          </div>
          <div className="p-2 rounded-xl bg-white/5 border border-white/5">
            <span className="block font-bold text-white mb-0.5">Road ETAs</span>
            <span>OSRM Routing</span>
          </div>
        </div>
      </div>
    </div>
  );
}
