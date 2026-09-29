'use client';

import { Compass, Wifi, WifiOff, Gauge, Battery } from 'lucide-react';

interface MobileTopBarProps {
  tripName: string;
  sessionCode: string;
  isConnected: boolean;
  currentSpeed: number;
  gpsMode: string;
  intervalSeconds: number;
}

export function MobileTopBar({
  tripName,
  sessionCode,
  isConnected,
  currentSpeed,
  gpsMode,
  intervalSeconds,
}: MobileTopBarProps) {
  return (
    <div className="fixed top-2.5 inset-x-3.5 z-20 pointer-events-none pt-safe">
      <div className="glass-panel-elevated rounded-2xl px-3.5 py-2 flex items-center justify-between shadow-2xl border border-white/10 pointer-events-auto">
        {/* Left: Trip Name & Room Code */}
        <div className="flex items-center gap-2 truncate max-w-[170px] sm:max-w-xs">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white shrink-0 shadow-md">
            <Compass className="w-4 h-4" />
          </div>
          <div className="truncate">
            <h1 className="font-extrabold text-xs text-white tracking-tight leading-tight truncate">
              {tripName || 'Squad Trip'}
            </h1>
            <div className="flex items-center gap-1 text-[10px] font-mono text-gray-400">
              <span>CODE:</span>
              <span className="font-bold text-indigo-400">{sessionCode}</span>
            </div>
          </div>
        </div>

        {/* Center: Live Speedometer Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 font-mono">
          <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-bold text-white tracking-tight">
            {Math.round(currentSpeed)} <span className="text-[10px] text-gray-400 font-normal">km/h</span>
          </span>
        </div>

        {/* Right: Live Connection Dot & Battery-aware GPS */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            {isConnected ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>LIVE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-rose-400" />
                <span>OFFLINE</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
