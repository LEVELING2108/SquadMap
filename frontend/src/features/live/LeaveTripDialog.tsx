import { LogOut } from 'lucide-react';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { describeFailure } from '../auth/formErrors';

type LeaveTripDialogProps = {
  open: boolean;
  pending: boolean;
  error: unknown;
  onLeave: () => void;
  onClose: () => void;
};

/** Leaving asks first: friends stop seeing you, and the trip carries on without you. */
export function LeaveTripDialog({ open, pending, error, onLeave, onClose }: LeaveTripDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="leave-trip-title" describedBy="leave-trip-text">
      <span
        aria-hidden="true"
        className="mx-auto flex size-16 items-center justify-center rounded-[22px] bg-red-bg text-red"
      >
        <LogOut className="size-8" />
      </span>
      <h2 id="leave-trip-title" className="text-[22px] leading-7 font-heading tracking-[-0.3px]">
        Leave this trip?
      </h2>
      <p id="leave-trip-text" className="text-[15px] leading-[21px] text-muted">
        Your friends stop seeing you on the map. The trip carries on without you.
      </p>
      {error !== null && <Banner tone="error">{describeFailure(error)}</Banner>}
      <Button variant="danger" onClick={onLeave} disabled={pending}>
        {pending ? 'Leaving…' : 'Leave trip'}
      </Button>
      <Button variant="glass" onClick={onClose}>
        Stay on the trip
      </Button>
    </Dialog>
  );
}
