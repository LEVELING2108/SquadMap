'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { ArrivedEvent } from '../types/squad';
import { PartyPopper, X } from 'lucide-react';

interface ArrivalCelebrationProps {
  arrival: ArrivedEvent | null;
  onDismiss: () => void;
}

export function ArrivalCelebration({ arrival, onDismiss }: ArrivalCelebrationProps) {
  useEffect(() => {
    if (arrival) {
      // Confetti burst
      const count = 200;
      const defaults = { origin: { y: 0.7 } };

      function fire(particleRatio: number, opts: confetti.Options) {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio),
        });
      }

      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });

      const timer = setTimeout(() => {
        onDismiss();
      }, 7000);

      return () => clearTimeout(timer);
    }
  }, [arrival, onDismiss]);

  if (!arrival) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300 w-[90%] max-w-md">
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600/90 via-teal-600/90 to-emerald-700/90 text-white shadow-2xl border border-emerald-400/50 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl shrink-0">
            🎉
          </div>
          <div>
            <h4 className="font-extrabold text-sm tracking-wide">
              {arrival.displayName} Has Arrived!
            </h4>
            <p className="text-xs text-emerald-100 opacity-90 mt-0.5">
              Within 100m geofence destination area
            </p>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
