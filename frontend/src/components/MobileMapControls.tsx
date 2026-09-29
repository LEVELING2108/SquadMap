'use client';

import { Crosshair, Compass, Car, Pause, Play, Share2 } from 'lucide-react';

interface MobileMapControlsProps {
  isSimulating: boolean;
  isPaused: boolean;
  onFollowMe: () => void;
  onNorthUp: () => void;
  onToggleSimulate: () => void;
  onTogglePause: () => void;
  onOpenShare: () => void;
}

export function MobileMapControls({
  isSimulating,
  isPaused,
  onFollowMe,
  onNorthUp,
  onToggleSimulate,
  onTogglePause,
  onOpenShare,
}: MobileMapControlsProps) {
  return (
    <div className="fixed right-3.5 top-20 z-20 flex flex-col gap-2.5">
      {/* Follow Me / Recenter */}
      <button
        onClick={onFollowMe}
        title="Center on my car"
        className="w-11 h-11 rounded-2xl glass-panel-elevated flex items-center justify-center text-white border border-white/10 shadow-xl active-press"
      >
        <Crosshair className="w-5 h-5 text-indigo-400" />
      </button>

      {/* Snap North */}
      <button
        onClick={onNorthUp}
        title="Orient North"
        className="w-11 h-11 rounded-2xl glass-panel-elevated flex items-center justify-center text-white border border-white/10 shadow-xl active-press"
      >
        <Compass className="w-5 h-5 text-cyan-400" />
      </button>

      {/* Simulate Drive Toggle */}
      <button
        onClick={onToggleSimulate}
        title={isSimulating ? 'Stop drive simulation' : 'Simulate drive'}
        className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-xl active-press transition-colors ${
          isSimulating
            ? 'bg-cyan-600 text-white border-cyan-400 shadow-cyan-600/40 animate-pulse'
            : 'glass-panel-elevated text-gray-300 border-white/10'
        }`}
      >
        <Car className="w-5 h-5" />
      </button>

      {/* Privacy Pause Toggle */}
      <button
        onClick={onTogglePause}
        title={isPaused ? 'Resume GPS sharing' : 'Pause GPS sharing'}
        className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-xl active-press transition-colors ${
          isPaused
            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
            : 'glass-panel-elevated text-gray-300 border-white/10'
        }`}
      >
        {isPaused ? <Play className="w-4 h-4 text-amber-400" /> : <Pause className="w-4 h-4" />}
      </button>

      {/* Share / Invite */}
      <button
        onClick={onOpenShare}
        title="Share trip"
        className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-600 flex items-center justify-center text-white border border-indigo-400/40 shadow-xl shadow-indigo-600/30 active-press"
      >
        <Share2 className="w-4 h-4" />
      </button>
    </div>
  );
}
