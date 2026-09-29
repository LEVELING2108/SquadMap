'use client';

import { Mic, Radio, MessageSquare, Volume2 } from 'lucide-react';

interface MobilePttBarProps {
  isMicReady: boolean;
  isTalking: boolean;
  activeSpeaker: { id: string; name: string } | null;
  unreadChatCount: number;
  onEnableMic: () => Promise<boolean>;
  onStartTalking: () => void;
  onStopTalking: () => void;
  onOpenChat: () => void;
}

export function MobilePttBar({
  isMicReady,
  isTalking,
  activeSpeaker,
  unreadChatCount,
  onEnableMic,
  onStartTalking,
  onStopTalking,
  onOpenChat,
}: MobilePttBarProps) {
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(40);
    }
    onStartTalking();
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
    onStopTalking();
  };

  return (
    <div className="fixed bottom-28 right-4 left-4 z-20 flex items-center justify-between pointer-events-none">
      {/* Left: Chat Button with Unread Badge */}
      <button
        onClick={onOpenChat}
        className="pointer-events-auto p-3.5 rounded-full glass-panel-elevated text-gray-200 hover:text-white border border-white/15 shadow-2xl active-press relative"
      >
        <MessageSquare className="w-5 h-5 text-indigo-400" />
        {unreadChatCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce shadow-md">
            {unreadChatCount}
          </span>
        )}
      </button>

      {/* Center: Active Speaker Pill (if someone is speaking) */}
      {activeSpeaker && (
        <div className="pointer-events-auto glass-panel px-3.5 py-1.5 rounded-full flex items-center gap-2 border-emerald-500/40 bg-emerald-950/70 shadow-xl animate-pulse">
          <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold text-emerald-300 truncate max-w-[130px]">
            {activeSpeaker.name}
          </span>
          <div className="flex items-center gap-0.5">
            <span className="w-1 h-3 bg-emerald-400 rounded-full soundwave-bar"></span>
            <span className="w-1 h-4 bg-emerald-400 rounded-full soundwave-bar [animation-delay:0.2s]"></span>
            <span className="w-1 h-2 bg-emerald-400 rounded-full soundwave-bar [animation-delay:0.4s]"></span>
          </div>
        </div>
      )}

      {/* Right: Big Thumb Push-To-Talk Button */}
      {!isMicReady ? (
        <button
          onClick={onEnableMic}
          className="pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold text-xs tracking-wider shadow-2xl shadow-indigo-600/50 border border-indigo-400/40 active-press"
        >
          <Radio className="w-4 h-4 animate-pulse" />
          <span>JOIN VOICE</span>
        </button>
      ) : (
        <div className="pointer-events-auto relative">
          {/* Radial Pulse rings while transmitting */}
          {isTalking && (
            <div className="absolute -inset-2 rounded-full bg-rose-500/30 animate-ping pointer-events-none" />
          )}

          <button
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
            className={`w-16 h-16 rounded-full flex flex-col items-center justify-center font-black transition-all select-none shadow-2xl border-2 active-press ${
              isTalking
                ? 'bg-rose-600 text-white border-rose-300 scale-110 shadow-rose-600/70'
                : 'glass-panel-elevated text-gray-200 border-indigo-500/40 hover:border-indigo-400 shadow-indigo-600/20'
            }`}
          >
            <Mic className={`w-6 h-6 ${isTalking ? 'text-white animate-pulse' : 'text-indigo-400'}`} />
            <span className="text-[9px] font-bold tracking-tighter mt-0.5">
              {isTalking ? 'TALKING' : 'HOLD'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
