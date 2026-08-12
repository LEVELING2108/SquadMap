"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { MapPin, Navigation, Users, ArrowRight, Clock, ShieldAlert } from "lucide-react";
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
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading trip session room...</p>
        </div>
      </main>
    );
  }

  if (error || !session) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-100">Session Not Available</h1>
          <p className="text-sm text-slate-400">
            {error?.message || "This trip room code does not exist or has expired."}
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            Create a New Trip
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-2xl backdrop-blur-xl space-y-6 z-10">
        {/* Room Header Badge */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-emerald-400 flex items-center justify-center">
              <Navigation className="w-4 h-4 text-white transform rotate-45" />
            </div>
            <span className="font-bold text-sm text-slate-200">SquadMap Invite</span>
          </div>
          <span className="text-xs font-mono bg-blue-500/10 border border-blue-500/30 text-blue-400 px-2.5 py-1 rounded-full font-semibold">
            {session.code}
          </span>
        </div>

        {/* Destination Card Info */}
        <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3">
          <div className="text-xs text-slate-400">You're invited to join:</div>
          <h2 className="text-lg font-bold text-white leading-tight">
            {session.title || `Trip to ${session.destinationName}`}
          </h2>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <MapPin className="w-4 h-4" />
            <span>Destination: {session.destinationName}</span>
          </div>

          <div className="flex items-center justify-between border-t border-slate-900 pt-3 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>{session.participants.length} Participant{session.participants.length > 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Active Trip Room</span>
            </div>
          </div>
        </div>

        {/* Join Form */}
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Enter your display name to join:
            </label>
            <input
              type="text"
              placeholder="e.g. Sam"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={joinMutation.isPending}
            className="w-full bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-medium py-3 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 cursor-pointer"
          >
            <span>{joinMutation.isPending ? "Joining..." : "Join Trip & View Live Map"}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      </div>
    </main>
  );
}
