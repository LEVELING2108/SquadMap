import type { Ref } from 'react';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { Stamp } from '../../components/ui/Stamp';
import { StatTile } from '../../components/ui/StatTile';
import { describeFailure } from '../auth/formErrors';
import { distanceText, lengthText, type TripSummary } from '../trip/summaryApi';
import { behindText } from './liveFormat';

type ArrivedSheetProps = {
  ref?: Ref<HTMLElement>;
  /** Short name of the destination, as on the stamp and in the sentence. */
  destination: string;
  /** Your numbers so far; null while they load. */
  summary: TripSummary | null;
  /** Minutes until each friend still on the way arrives (from the live ETAs). */
  behindMinutes: number[];
  /** Friends on the trip, arrived or not. */
  friends: number;
  unit: 'km' | 'mi';
  /** True while finishing (leaving the trip) is being sent. */
  finishing: boolean;
  finishError: unknown;
  onKeepSharing: () => void;
  onFinish: () => void;
};

/** The first word of the place, short enough to curve along the stamp's edge: "PHOENIX". */
function stampPlace(destination: string): string {
  const first = destination.trim().split(/\s+/)[0] ?? '';
  return first.toUpperCase().slice(0, 10);
}

/**
 * "You made it!" (E3): shown once when you reach the destination. The map stays live underneath, blurred,
 * and sharing carries on unless you choose to finish.
 */
export function ArrivedSheet({
  ref,
  destination,
  summary,
  behindMinutes,
  friends,
  unit,
  finishing,
  finishError,
  onKeepSharing,
  onFinish,
}: ArrivedSheetProps) {
  const loading = '…';
  const day = new Date().toLocaleDateString('en', { weekday: 'short' }).toUpperCase();

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-screen/30 backdrop-blur-[6px]">
      <div className="relative flex flex-1 items-center justify-center">
        <Stamp
          word="ARRIVED"
          bottom={`${stampPlace(destination)} · ${day}`}
          wordSize={27}
          className="motion-stamp size-[164px]"
        />
      </div>
      <section
        ref={ref}
        aria-labelledby="arrived-title"
        className="motion-sheet glass glass-strong flex flex-col gap-3 rounded-t-sheet px-5 pt-3 pb-[max(24px,env(safe-area-inset-bottom))]"
      >
        <div aria-hidden="true" className="mx-auto mb-1 h-1 w-10 flex-none rounded-[2px] bg-handle" />
        <h1 id="arrived-title" className="text-center text-[30px] leading-9 font-extrabold tracking-[-0.5px]">
          You made it!
        </h1>
        <p className="text-center text-[15px] leading-[22px] text-muted">
          You reached {destination}.{behindText(behindMinutes, friends)}
        </p>
        <dl aria-busy={summary === null} className="m-0 flex flex-wrap gap-2.5">
          <StatTile
            value={summary ? distanceText(summary.distanceM, unit) : loading}
            label="Travelled"
            className="glass-strong"
          />
          <StatTile
            value={summary ? lengthText(summary.durationSeconds) : loading}
            label="Time"
            className="glass-strong"
          />
          <StatTile
            value={String(friends)}
            label={friends === 1 ? 'Friend' : 'Friends'}
            className="glass-strong"
          />
        </dl>
        {finishError !== null && finishError !== undefined && (
          <Banner tone="error">{describeFailure(finishError)}</Banner>
        )}
        <Button onClick={onKeepSharing}>Keep sharing</Button>
        <Button variant="glass" onClick={onFinish} disabled={finishing}>
          {finishing ? 'Finishing…' : 'Stop sharing and finish'}
        </Button>
      </section>
    </div>
  );
}
