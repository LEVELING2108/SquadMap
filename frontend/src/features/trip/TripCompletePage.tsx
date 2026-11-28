import { Illustration } from '../../components/ui/Illustration';
import { useNavigate, useParams } from 'react-router';
import { MessageSquare } from 'lucide-react';
import { Banner } from '../../components/ui/Banner';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Stamp } from '../../components/ui/Stamp';
import { describeFailure } from '../auth/formErrors';
import { signOut, useSession } from '../auth/session';
import { useSettings } from '../profile/settingsApi';
import { useTripSummary } from './summaryApi';
import { TripSummaryPass } from './TripSummaryPass';
import { useTrip } from './tripQueries';

/** "19 Nov": the day a trip started, beside its name. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en', { day: 'numeric', month: 'short' });
}

/**
 * Trip complete (E5): where everyone lands when a trip ends, and where a past trip opens from history.
 * Also shown to someone who finished early while friends carry on, with words to match.
 */
export function TripCompletePage() {
  const { tripId = '' } = useParams();
  const navigate = useNavigate();
  const guest = useSession((state) => state.status) === 'guest';
  const summary = useTripSummary(tripId);
  const trip = useTrip(tripId);
  const { settings } = useSettings();

  const data = summary.data ?? null;
  const stillRunning = data?.status === 'active';
  // The chat stays readable for a week after the trip, for people still on it.
  const chatHref = trip.data?.chatEnabled ? `/trip/${tripId}/chat` : null;

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[600px] flex-col overflow-hidden bg-screen">
      <div aria-hidden="true" className="absolute inset-0">
        <Illustration name="hero" className="size-full object-cover object-top" />
      </div>

      <div className="relative flex flex-1 flex-col gap-5 px-5 pt-[max(48px,env(safe-area-inset-top))] pb-16">
        <div className="motion-rise">
          <h1
            id="complete-title"
            className="text-[32px] leading-[38px] font-heading tracking-[-0.5px] text-ink"
          >
            {stillRunning ? 'You’ve finished' : 'Trip complete'}
          </h1>
          <p className="truncate text-base leading-[22px] font-bold text-ink">
            {data ? `${data.name} · ${dayLabel(data.startsAt)}` : ' '}
          </p>
        </div>

        <div className="relative">
          <TripSummaryPass summary={data} unit={settings.distanceUnit} timeFormat={settings.timeFormat} />
          {!stillRunning && (
            <Stamp
              word="ENDED"
              className="motion-stamp absolute -bottom-[100px] left-1/2 size-[112px] -translate-x-1/2"
            />
          )}
        </div>
      </div>

      <section
        aria-labelledby="complete-title"
        className="motion-sheet glass glass-strong relative z-10 flex flex-col gap-3 rounded-t-sheet px-5 pt-3 pb-[max(24px,env(safe-area-inset-bottom))]"
      >
        <div aria-hidden="true" className="mx-auto mb-1 h-1 w-10 flex-none rounded-[2px] bg-handle" />
        {summary.isError ? (
          <Banner tone="error">
            {describeFailure(summary.error)}{' '}
            <button type="button" onClick={() => void summary.refetch()} className="font-extrabold underline">
              Retry
            </button>
          </Banner>
        ) : (
          <p className="text-center text-[15px] leading-[22px] text-muted">
            {stillRunning
              ? 'You stopped sharing. Friends on the trip can no longer see you.'
              : 'Everyone stopped sharing. Your location is no longer stored.'}
          </p>
        )}

        {guest ? (
          <Button onClick={() => void signOut().then(() => navigate('/', { replace: true }))}>Done</Button>
        ) : (
          <>
            <ButtonLink to="/home">Back to home</ButtonLink>
            <ButtonLink to="/me/history" variant="glass">
              View trip history
            </ButtonLink>
          </>
        )}
        {chatHref && !stillRunning && (
          <ButtonLink to={chatHref} variant="text">
            <MessageSquare aria-hidden="true" className="size-5" />
            Read the trip chat
          </ButtonLink>
        )}
        {!guest && (
          <ButtonLink to="/trip/new/destination" variant="text">
            Plan another trip
          </ButtonLink>
        )}
      </section>
    </main>
  );
}
