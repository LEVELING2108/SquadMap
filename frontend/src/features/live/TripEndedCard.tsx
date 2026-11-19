import { Flag, MessageSquare } from 'lucide-react';
import { Button, ButtonLink } from '../../components/ui/Button';

type TripEndedCardProps = {
  guest: boolean;
  onDone: () => void;
  /** The trip chat, which stays readable for a week after the trip, when chat was on. */
  chatHref?: string;
};

/** Shown in place of the live view once the trip is over: sharing has stopped for everyone. */
export function TripEndedCard({ guest, onDone, chatHref }: TripEndedCardProps) {
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
      {chatHref && (
        <ButtonLink to={chatHref} variant="glass">
          <MessageSquare aria-hidden="true" className="size-5" />
          Read the trip chat
        </ButtonLink>
      )}
      {guest ? <Button onClick={onDone}>Done</Button> : <ButtonLink to="/home">Back to home</ButtonLink>}
    </div>
  );
}
