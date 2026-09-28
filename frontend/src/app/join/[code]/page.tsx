'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { joinSession } from '../../../lib/api';
import { Compass, ArrowRight, Loader2 } from 'lucide-react';

const AVATAR_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

export default function JoinCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    try {
      setIsLoading(true);
      setErrorMsg(null);

      const cleanCode = code.toUpperCase();
      const res = await joinSession(cleanCode, {
        displayName: displayName.trim(),
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#090d16]">
      <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8 max-w-md w-full border border-white/10 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-3 border border-indigo-500/30">
            <Compass className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-white">Join Squad Trip</h2>
          <p className="text-sm text-gray-400 mt-1">
            Trip Code: <span className="font-mono font-bold text-indigo-400">{code.toUpperCase()}</span>
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-5">
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Your Display Name
            </label>
            <input
              type="text"
              required
              autoFocus
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Maya"
              className="w-full bg-gray-900/90 text-white text-base rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Choose Avatar Color
            </label>
            <div className="flex gap-2 items-center overflow-x-auto pb-1">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`w-8 h-8 rounded-full shrink-0 transition-transform ${
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
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>ENTER SQUAD MAP</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
