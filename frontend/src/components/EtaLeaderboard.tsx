'use client';

import { useState } from 'react';
import { Participant, EtaParticipant } from '../types/squad';
import { ChevronUp, ChevronDown, CheckCircle2, Gauge, MapPin, Users } from 'lucide-react';

interface EtaLeaderboardProps {
  destinationName?: string;
  participants: Participant[];
  etas: EtaParticipant[];
  currentUserId: string;
}

export function EtaLeaderboard({
  destinationName,
  participants,
  etas,
  currentUserId,
}: EtaLeaderboardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Merge participant metadata with calculated ETAs
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

  return (
    <div className="glass-panel-elevated rounded-2xl overflow-hidden transition-all duration-300 w-full max-w-md shadow-2xl">
      {/* Header bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide">Squad Leaderboard</span>
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                {participants.length}
              </span>
            </div>
            {destinationName && (
              <p className="text-[11px] text-gray-400 flex items-center gap-1 truncate max-w-[200px]">
                <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                {destinationName}
              </p>
            )}
          </div>
        </div>

        <button className="text-gray-400 hover:text-white p-1 rounded-lg">
          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </div>

      {/* Expanded list */}
      {isExpanded && (
        <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
          {rankedSquad.map((member, index) => (
            <div
              key={member.id}
              className={`p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                member.isSelf
                  ? 'bg-indigo-950/40 border-indigo-500/30 shadow-sm'
                  : 'bg-gray-900/40 border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Position rank badge */}
                <span className="w-5 text-center text-xs font-mono font-bold text-gray-500">
                  #{index + 1}
                </span>

                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md border"
                  style={{ backgroundColor: member.colorHex, borderColor: 'rgba(255,255,255,0.2)' }}
                >
                  {member.hasArrived ? '✓' : member.displayName.charAt(0).toUpperCase()}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-200">
                      {member.displayName}
                    </span>
                    {member.isSelf && (
                      <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/20 px-1.5 py-0.5 rounded">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Gauge className="w-3 h-3 text-gray-500" />
                      {Math.round(member.speed)} km/h
                    </span>
                    <span>•</span>
                    <span>{member.distanceFormatted}</span>
                  </div>
                </div>
              </div>

              {/* ETA / Arrival badge */}
              <div className="text-right">
                {member.hasArrived ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 animate-pulse">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Arrived
                  </span>
                ) : member.isPaused ? (
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-xs font-medium">
                    Paused
                  </span>
                ) : (
                  <div>
                    <span className="text-sm font-bold text-cyan-400 block font-mono">
                      {member.etaFormatted}
                    </span>
                    <span className="text-[10px] text-gray-500 block">ETA</span>
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
