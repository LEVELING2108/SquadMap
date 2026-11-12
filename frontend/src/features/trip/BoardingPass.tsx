import { ArrowRight, Plane } from 'lucide-react';
import { Barcode } from './Barcode';
import { shareLength, shortPlace } from './tripQueries';
import type { Trip } from './types';

/** The invite as a boarding-pass ticket: from you to the destination, with the trip code. */
export function BoardingPass({ trip }: { trip: Trip }) {
  const to = trip.destination ? shortPlace(trip.destination.name) : 'Anywhere';

  return (
    <div className="ticket-shadow">
      <section
        aria-label="Boarding pass"
        className="ticket"
        style={{ '--cut': '150px' } as React.CSSProperties}
      >
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs leading-4 font-extrabold tracking-[1.5px] text-coral-d">
              BOARDING PASS
            </span>
            <Plane aria-hidden="true" className="motion-bob size-5 text-blue-d" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs leading-4 text-muted">FROM</p>
              <p className="text-[22px] leading-7 font-extrabold">You</p>
            </div>
            <ArrowRight aria-hidden="true" className="size-6 flex-none text-muted" />
            <div className="min-w-0 text-right">
              <p className="text-xs leading-4 text-muted">TO</p>
              <p className="truncate text-[22px] leading-7 font-extrabold">{to}</p>
            </div>
          </div>
          <p className="mt-1.5 truncate text-xs leading-4 text-muted">
            {trip.name} · {shareLength(trip)}
          </p>
        </div>
        <div aria-hidden="true" className="h-7.5" />
        <div aria-hidden="true" className="mx-5 border-t-2 border-dashed border-perforation" />
        <div className="flex flex-col items-center gap-3 px-5 pt-4 pb-5">
          <p className="text-xs leading-4 font-bold tracking-[1.5px] text-muted">TRIP CODE</p>
          <p
            className="font-mono text-[30px] leading-9 tracking-[4px] text-blue-d"
            aria-label={spellOut(trip.code)}
          >
            {trip.code}
          </p>
          <Barcode code={trip.code} />
        </div>
      </section>
    </div>
  );
}

/** "K 7 Q X…": screen readers read the code character by character instead of as a word. */
function spellOut(code: string): string {
  return `Trip code ${code.split('').join(' ')}`;
}
