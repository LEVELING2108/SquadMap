import { useParams } from 'react-router';
import { MapPin } from 'lucide-react';
import { ButtonLink } from '../../components/ui/Button';
import { useTrip } from './tripQueries';

/**
 * Temporary stand-in for the live map, which arrives with real-time location. It confirms the trip is
 * reachable and leads back to the invite.
 */
export function TripPlaceholderPage() {
  const { tripId = '' } = useParams();
  const trip = useTrip(tripId);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col justify-center gap-4 bg-sand px-5 py-8">
      <section aria-labelledby="trip-title" className="glass-strong flex flex-col gap-4 rounded-card p-5">
        <MapPin aria-hidden="true" className="size-8 text-coral" />
        <h1 id="trip-title" className="text-[22px] leading-7 font-extrabold">
          {trip.data ? trip.data.name : 'Your trip'}
        </h1>
        <p className="text-sm leading-5 text-muted">
          The live map, where everyone on the trip appears, is the next thing being built.
        </p>
        {trip.data?.role === 'host' && <ButtonLink to={`/trip/${tripId}/invite`}>Show the invite</ButtonLink>}
        <ButtonLink to="/home" variant="glass">
          Back to home
        </ButtonLink>
      </section>
    </main>
  );
}
