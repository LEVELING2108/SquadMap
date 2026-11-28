import { Timer } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { formatClock } from '../../lib/time';
import type { Trip } from '../trip/types';
import { ExtendChoice } from './ExtendChoice';

type ExtendDialogProps = {
  open: boolean;
  trip: Trip;
  /** "3 h left". */
  left: string;
  timeFormat: '12h' | '24h';
  onClose: () => void;
  onExtended: (trip: Trip) => void;
};

/** Extend sharing time, from the trip menu. Host only. */
export function ExtendDialog({ open, trip, left, timeFormat, onClose, onExtended }: ExtendDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="extend-title" describedBy="extend-text">
      <span
        aria-hidden="true"
        className="mx-auto flex size-16 items-center justify-center rounded-[22px] bg-sea-bg text-sea-d"
      >
        <Timer className="size-8" />
      </span>
      <h2 id="extend-title" className="text-[22px] leading-7 font-heading tracking-[-0.3px]">
        Extend sharing time
      </h2>
      <p id="extend-text" className="text-[15px] leading-[21px] text-muted">
        Sharing ends at {formatClock(trip.expiresAt, timeFormat)}, {left}.
      </p>
      <ExtendChoice key={trip.expiresAt} trip={trip} onExtended={onExtended} />
      <Button variant="text" onClick={onClose}>
        Cancel
      </Button>
    </Dialog>
  );
}
