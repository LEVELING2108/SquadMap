import { useNavigate, useParams } from 'react-router';
import { MapPin } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import { Banner } from '../../components/ui/Banner';
import { Button, ButtonLink } from '../../components/ui/Button';
import { describeFailure } from '../auth/formErrors';
import { signOut, useSession } from '../auth/session';
import { useTrip } from './tripQueries';

/**
 * Temporary stand-in for the live map, which arrives with real-time location. It confirms the trip is
 * reachable, leads the host back to the invite, and lets a guest leave.
 */
export function TripPlaceholderPage() {
  const { tripId = '' } = useParams();
  const navigate = useNavigate();
  const trip = useTrip(tripId);
  const guest = useSession((state) => state.guest);

  // A guest leaves the trip, which ends their pass, and this device forgets them.
  const leave = useMutation({
    mutationFn: () => api<void>(`/trips/${encodeURIComponent(tripId)}/members/me`, { method: 'DELETE' }),
    onSuccess: async () => {
      await signOut();
      navigate('/', { replace: true });
    },
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col justify-center gap-4 bg-sand px-5 py-8">
      <section aria-labelledby="trip-title" className="glass-strong flex flex-col gap-4 rounded-card p-5">
        <MapPin aria-hidden="true" className="size-8 text-coral" />
        <h1 id="trip-title" className="text-[22px] leading-7 font-extrabold">
          {trip.data ? trip.data.name : 'Your trip'}
        </h1>
        {guest && <p className="text-sm leading-5 font-bold">You joined as {guest.displayName}.</p>}
        <p className="text-sm leading-5 text-muted">
          The live map, where everyone on the trip appears, is the next thing being built.
        </p>
        {trip.data?.role === 'host' && <ButtonLink to={`/trip/${tripId}/invite`}>Show the invite</ButtonLink>}
        {guest ? (
          <>
            {leave.isError && <Banner tone="error">{describeFailure(leave.error)}</Banner>}
            <Button variant="glass" onClick={() => leave.mutate()} disabled={leave.isPending}>
              {leave.isPending ? 'Leaving…' : 'Leave trip'}
            </Button>
          </>
        ) : (
          <ButtonLink to="/home" variant="glass">
            Back to home
          </ButtonLink>
        )}
      </section>
    </main>
  );
}
