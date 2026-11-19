import { Clock } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { formatClock } from '../../lib/time';
import type { Trip } from '../trip/types';
import { ExtendChoice } from './ExtendChoice';
import { WARN_BEFORE_MS } from './tripActions';

type ExpiryWarningProps = {
  open: boolean;
  trip: Trip;
  isHost: boolean;
  /** Whether this person's location is being shared, which changes what ending means for them. */
  sharing: boolean;
  now: number;
  timeFormat: '12h' | '24h';
  onDismiss: () => void;
  onEndNow: () => void;
  onExtended: (trip: Trip) => void;
};

const RING = 2 * Math.PI * 34;

/**
 * Trip ending soon (E1): ten minutes before sharing stops, everyone on the trip is told. The host can add
 * time or end the trip now; anyone else learns when it ends.
 */
export function ExpiryWarning({
  open,
  trip,
  isHost,
  sharing,
  now,
  timeFormat,
  onDismiss,
  onEndNow,
  onExtended,
}: ExpiryWarningProps) {
  const remaining = Math.max(0, Date.parse(trip.expiresAt) - now);
  const minutes = Math.max(1, Math.ceil(remaining / 60_000));
  const clock = formatClock(trip.expiresAt, timeFormat);
  const share = Math.min(1, remaining / WARN_BEFORE_MS);

  return (
    <Dialog open={open} onClose={onDismiss} labelledBy="expiry-title" describedBy="expiry-text">
      <div aria-hidden="true" className="relative mx-auto size-24">
        <svg viewBox="0 0 96 96" className="size-24">
          <circle cx="48" cy="48" r="34" fill="none" strokeWidth="8" className="stroke-line" />
          <circle
            cx="48"
            cy="48"
            r="34"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - share)}
            transform="rotate(-90 48 48)"
            className="stroke-coral transition-[stroke-dashoffset] duration-(--dur-slow) ease-soft"
          />
        </svg>
        <Clock className="absolute inset-0 m-auto size-9 text-ink" />
      </div>
      <h2 id="expiry-title" className="text-[22px] leading-7 font-extrabold tracking-[-0.3px]">
        Sharing ends in {minutes} min
      </h2>
      <p id="expiry-text" className="text-[15px] leading-[21px] text-muted">
        {sharing
          ? `Your location will stop being shared with friends at ${clock}.`
          : `The trip ends at ${clock}.`}
        {!isHost && ' Only the host can add more time.'}
      </p>
      {isHost && (
        <>
          <ExtendChoice key={trip.expiresAt} trip={trip} onExtended={onExtended} />
          <Button variant="glass" onClick={onEndNow}>
            End now
          </Button>
        </>
      )}
      <Button variant={isHost ? 'text' : 'glass'} onClick={onDismiss}>
        Dismiss
      </Button>
    </Dialog>
  );
}
