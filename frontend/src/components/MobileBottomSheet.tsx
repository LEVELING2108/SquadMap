'use client';

import { useState } from 'react';
import { Participant, EtaParticipant } from '../types/squad';
import {
  ChevronUp,
  ChevronDown,
  Navigation,
  Gauge,
  CheckCircle2,
  Users,
  MapPin,
  ExternalLink,
} from 'lucide-react';

interface MobileBottomSheetProps {
  destinationName?: string;
  destinationLat?: number;
  destinationLng?: number;
  participants: Participant[];
  etas: EtaParticipant[];
  currentUserId: string;
  onFocusMember: (userId: string) => void;
  onOpenShare: () => void;
}

export function MobileBottomSheet({
  destinationName,
  destinationLat,
  destinationLng,
  participants,
  etas,
  currentUserId,
  onFocusMember,
  onOpenShare,
}: MobileBottomSheetProps) {
  // Sheet state: 'collapsed' | 'half' | 'full'
  const [sheetState, setSheetState] = useState<'collapsed' | 'half' | 'full'>('collapsed');

  // Find current user's ETA
  const myEta = etas.find((e) => e.participantId === currentUserId);
  const me = participants.find((p) => p.id === currentUserId);

  // Ranked squad list
  const rankedSquad = participants.map((p) => {
    const eta = etas.find((e) => e.participantId === p.id);
    return {
      id: p.id,
      displayName: p.displayName,
      colorHex: p.colorHex || '#3B82F6',
      speed: p.speed ?? 0,
      hasArrived: p.hasArrived ?? false,
      isPaused: p.isPaused ?? false,
      isSelf: p.id === currentUserId,
      etaFormatted: eta?.etaFormatted ?? (p.hasArrived ? 'Arrived 🎉' : 'Calculating...'),
      distanceFormatted: eta?.distanceFormatted ?? (p.lat && p.lng ? '--' : 'No GPS'),
      durationSeconds: eta?.durationSeconds ?? 999999,
    };
  });

  rankedSquad.sort((a, b) => {
    if (a.hasArrived && !b.hasArrived) return -1;
    if (!a.hasArrived && b.hasArrived) return 1;
    return a.durationSeconds - b.durationSeconds;
  });

  const toggleSheet = () => {
    if (sheetState === 'collapsed') setSheetState('half');
    else if (sheetState === 'half') setSheetState('full');
    else setSheetState('collapsed');
  };

  // Open native navigation app
  const handleOpenNativeNavigation = () => {
    if (!destinationLat || !destinationLng) return;
    const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    if (isIos) {
      window.open(`maps://?q=${destinationLat},${destinationLng}`, '_system');
    } else {
      window.open(`geo:${destinationLat},${destinationLng}?q=${destinationLat},${destinationLng}`, '_system');
    }
  };

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 transition-all duration-300 ease-out glass-sheet rounded-t-[28px] flex flex-col ${
        sheetState === 'collapsed'
          ? 'h-24'
          : sheetState === 'half'
          ? 'h-[50dvh]'
          : 'h-[86dvh]'
      }`}
    >
      {/* Drag grabber */}
      <div onClick={toggleSheet} className="w-full pt-1.5 pb-1 cursor-pointer select-none">
        <div className="sheet-handle" />
      </div>

      {/* Collapsed Peek Header */}
      <div className="px-5 pb-2 flex items-center justify-between">
        <div onClick={toggleSheet} className="flex-1 cursor-pointer">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-white font-mono tracking-tight">
              {myEta?.etaFormatted || (me?.hasArrived ? 'Arrived 🎉' : '-- min')}
            </span>
            <span className="text-xs text-cyan-400 font-semibold font-mono">
              {myEta?.distanceFormatted || '--'}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            <div className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>{participants.length} in convoy</span>
            </div>
          </div>
          <div className="text-xs text-gray-400 truncate flex items-center gap-1 mt-0.5 max-w-[260px]">
            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">{destinationName || 'Destination'}</span>
          </div>
        </div>

        {/* Toggle chevron */}
        <button
          onClick={toggleSheet}
          className="p-2 text-gray-400 hover:text-white rounded-full bg-white/5 active-press"
        >
          {sheetState === 'collapsed' ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Expanded Content (Squad Leaderboard) */}
      {sheetState !== 'collapsed' && (
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2.5 pb-safe">
          {/* Quick Actions Row */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={handleOpenNativeNavigation}
              className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 flex items-center justify-center gap-1.5 active-press"
            >
              <Navigation className="w-3.5 h-3.5 text-cyan-400" />
              <span>Turn-by-Turn Nav</span>
            </button>
            <button
              onClick={onOpenShare}
              className="py-2.5 px-4 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-bold border border-indigo-500/30 flex items-center justify-center gap-1.5 active-press"
            >
              <span>+ Invite</span>
            </button>
          </div>

          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
            Convoy Members ({participants.length})
          </div>

          {/* Members list */}
          {rankedSquad.map((member, index) => (
            <div
              key={member.id}
              onClick={() => onFocusMember(member.id)}
              className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer active-press ${
                member.isSelf
                  ? 'bg-indigo-950/40 border-indigo-500/40 shadow-sm'
                  : 'bg-gray-900/60 border-white/5 hover:border-white/15'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-4 text-center text-xs font-mono font-bold text-gray-500">
                  {index + 1}
                </span>

                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md border-2 border-white/20"
                  style={{ backgroundColor: member.colorHex }}
                >
                  {member.hasArrived ? '✓' : member.displayName.charAt(0).toUpperCase()}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-gray-100">
                      {member.displayName}
                    </span>
                    {member.isSelf && (
                      <span className="text-[9px] font-extrabold text-indigo-400 bg-indigo-500/20 px-1.5 py-0.5 rounded-full">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Gauge className="w-3 h-3 text-gray-500" />
                      {Math.round(member.speed)} km/h
                    </span>
                    <span>•</span>
                    <span>{member.distanceFormatted}</span>
                  </div>
                </div>
              </div>

              {/* Status & ETA */}
              <div className="text-right">
                {member.hasArrived ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-extrabold border border-emerald-500/40">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Arrived
                  </span>
                ) : member.isPaused ? (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs font-medium">
                    Paused
                  </span>
                ) : (
                  <div>
                    <span className="text-base font-extrabold text-cyan-400 block font-mono">
                      {member.etaFormatted}
                    </span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider block">
                      ETA
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
