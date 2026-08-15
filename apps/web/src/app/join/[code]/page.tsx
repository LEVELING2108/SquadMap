"use client";

import { use, useState } from "react";


import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { MapPin, Compass, Users, ArrowRight, Clock, ShieldAlert, Mountain } from "lucide-react";
import { toast } from "sonner";

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const code = resolvedParams.code.toUpperCase();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");

  const { data: session, isLoading, error } = useQuery(
    trpc.session.getSession.queryOptions({ code })
  );

  const joinMutation = useMutation(trpc.session.joinSession.mutationOptions({
    onSuccess: (data) => {
      if (typeof window !== "undefined") {
        localStorage.setItem(`squadmap_participant_${data.session.code}`, data.participant.id);
        localStorage.setItem(`squadmap_name_${data.session.code}`, data.participant.displayName);
      }
      toast.success(`Welcome to ${data.session.title || "the trip"}!`);
      router.push(`/room/${data.session.code}`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to join room");
    },
  }));

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Please enter your display name");
      return;
    }
    joinMutation.mutate({
      code,
      displayName: displayName.trim(),
    });
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-stone-50 text-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-emerald-800 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-600">Loading trip session room...</p>
        </div>
      </main>
    );
  }

  if (error || !session) {
    return (
      <main className="min-h-screen bg-stone-50 text-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Session Not Available</h1>
          <p className="text-sm text-slate-500">
            {error?.message || "This trip room code does not exist or has expired."}
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
          >
            Create a New Trip
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 text-slate-900 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Contour SVG */}
      <div className="absolute inset-0 opacity-10 pointer-events-none flex items-end justify-center overflow-hidden">
        <svg viewBox="0 0 1440 320" className="w-full h-80 fill-slate-900">
          <path d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,250.7C960,235,1056,181,1152,165.3C1248,149,1344,171,1392,181.3L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
      </div>

      <div className="max-w-md w-full bg-white border border-slate-200 p-6 sm:p-7 rounded-3xl shadow-sm space-y-6 z-10">
        {/* Room Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-800 flex items-center justify-center text-white">
              <Compass className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-slate-900">SquadMap Invite</span>
          </div>
          <span className="text-xs font-mono bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1 rounded-full font-bold">
            {session.code}
          </span>
        </div>

        {/* Trip Summary Card */}
        <div className="bg-slate-50 border border-slate-200/80 p-4.5 rounded-2xl space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            <Mountain className="w-3.5 h-3.5" />
            <span>Group Trip Invitation</span>
          </div>

          <h2 className="text-lg font-bold text-slate-900 leading-tight">
            {session.title || `Trip to ${session.destinationName}`}
          </h2>

          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <MapPin className="w-4 h-4 text-emerald-700" />
            <span>Destination: {session.destinationName}</span>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>{session.participants.length} Traveler{session.participants.length > 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Active Trip Room</span>
            </div>
          </div>
        </div>

        {/* Join Form */}
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Your Display Name
            </label>
            <input
              type="text"
              placeholder="e.g. Sam"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={joinMutation.isPending}
            className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-semibold py-3.5 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>{joinMutation.isPending ? "Joining..." : "Join Trip & See Live Map"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </main>
  );
}
