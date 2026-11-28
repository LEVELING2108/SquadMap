import { Power } from 'lucide-react';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { describeFailure } from '../auth/formErrors';
import type { Trip } from '../trip/types';
import { useEndTrip } from './tripActions';

type EndTripDialogProps = {
  open: boolean;
  tripId: string;
  /** How many other people are on the trip. */
  friends: number;
  onClose: () => void;
  onEnded: (trip: Trip) => void;
};

function consequence(friends: number): string {
  if (friends === 0) return 'Sharing stops right away and the invite link stops working.';
  if (friends === 1)
    return 'Your friend stops sharing location right away and the invite link stops working.';
  return `All ${friends} friends stop sharing location right away and the invite link stops working.`;
}

/** End trip (E2): the host confirms ending the trip for everyone. */
export function EndTripDialog({ open, tripId, friends, onClose, onEnded }: EndTripDialogProps) {
  const end = useEndTrip(tripId);

  return (
    <Dialog
      open={open}
      onClose={() => {
        end.reset();
        onClose();
      }}
      labelledBy="end-trip-title"
      describedBy="end-trip-text"
    >
      <span
        aria-hidden="true"
        className="mx-auto flex size-16 items-center justify-center rounded-[22px] bg-red-bg text-red"
      >
        <Power className="size-8" />
      </span>
      <h2 id="end-trip-title" className="text-[22px] leading-7 font-heading tracking-[-0.3px]">
        End this trip for everyone?
      </h2>
      <p id="end-trip-text" className="text-[15px] leading-[21px] text-muted">
        {consequence(friends)}
      </p>
      {end.isError && <Banner tone="error">{describeFailure(end.error)}</Banner>}
      <Button
        variant="danger"
        onClick={() => end.mutate(undefined, { onSuccess: onEnded })}
        disabled={end.isPending}
      >
        {end.isPending ? 'Ending…' : 'End trip'}
      </Button>
      <Button variant="glass" onClick={onClose}>
        Keep sharing
      </Button>
    </Dialog>
  );
}
