'use client';

import { useEffect } from 'react';
import { Mic, MicOff, Radio, Volume2 } from 'lucide-react';

interface WalkieTalkieControlsProps {
  isMicReady: boolean;
  isTalking: boolean;
  activeSpeaker: { id: string; name: string } | null;
  onEnableMic: () => Promise<boolean>;
  onStartTalking: () => void;
  onStopTalking: () => void;
}

export function WalkieTalkieControls({
  isMicReady,
  isTalking,
  activeSpeaker,
  onEnableMic,
  onStartTalking,
  onStopTalking,
}: WalkieTalkieControlsProps) {
  // Spacebar push-to-talk handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        onStartTalking();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        onStopTalking();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onStartTalking, onStopTalking]);

  return (
    <div className="flex items-center gap-3">
      {/* Active speaker notification banner */}
      {activeSpeaker && (
        <div className="glass-panel px-3 py-1.5 rounded-full flex items-center gap-2 border-emerald-500/40 bg-emerald-950/60 shadow-lg animate-pulse">
          <Volume2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-emerald-300">
            {activeSpeaker.name} is speaking...
          </span>
          <div className="flex items-center gap-0.5">
            <span className="w-1 h-3 bg-emerald-400 rounded-full animate-bounce"></span>
            <span className="w-1 h-4 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.15s]"></span>
            <span className="w-1 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.3s]"></span>
          </div>
        </div>
      )}

      {/* Push-to-Talk Button */}
      {!isMicReady ? (
        <button
          onClick={onEnableMic}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-transform active:scale-95 border border-indigo-400/40"
        >
          <Radio className="w-4 h-4 animate-pulse" />
          <span>Join Walkie-Talkie</span>
        </button>
      ) : (
        <div className="relative group">
          <button
            onMouseDown={onStartTalking}
            onMouseUp={onStopTalking}
            onTouchStart={onStartTalking}
            onTouchEnd={onStopTalking}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs tracking-wider transition-all select-none shadow-xl border ${
              isTalking
                ? 'bg-rose-600 text-white border-rose-400 shadow-rose-600/50 scale-105'
                : 'bg-gray-900/90 text-gray-200 border-white/10 hover:border-indigo-500/50 hover:bg-gray-800'
            }`}
          >
            {isTalking ? (
              <>
                <Mic className="w-4 h-4 animate-pulse text-white" />
                <span>TRANSMITTING...</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-indigo-400" />
                <span>HOLD TO TALK</span>
                <span className="hidden sm:inline text-[10px] text-gray-400 font-mono font-normal">
                  [Space]
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
