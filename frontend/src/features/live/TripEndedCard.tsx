import { Flag } from 'lucide-react';
import { Button, ButtonLink } from '../../components/ui/Button';

/** Shown in place of the live view once the trip is over: sharing has stopped for everyone. */
export function TripEndedCard({ guest, onDone }: { guest: boolean; onDone: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Flag aria-hidden="true" className="mt-1 size-5 flex-none text-coral" />
        <div>
          <h1 id="live-title" className="text-[20px] leading-[26px] font-extrabold">
            This trip has ended
          </h1>
          <p className="text-sm leading-5 text-muted">Location sharing has stopped for everyone.</p>
        </div>
      </div>
      {guest ? <Button onClick={onDone}>Done</Button> : <ButtonLink to="/home">Back to home</ButtonLink>}
    </div>
  );
}
