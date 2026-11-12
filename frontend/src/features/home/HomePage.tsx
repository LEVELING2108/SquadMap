import { Link, useNavigate } from 'react-router';
import { Compass } from 'lucide-react';
import { Button, ButtonLink } from '../../components/ui/Button';
import { describeFailure } from '../auth/formErrors';
import { signOut, useSession } from '../auth/session';
import { useActiveTrips } from '../trip/tripQueries';

/** Running trips, each leading to its invite (host) or its trip page (member). */
function YourTrips() {
  const trips = useActiveTrips(true);

  if (trips.isPending) return <p className="text-sm leading-5 text-muted">Loading your trips…</p>;
  if (trips.isError) return <p className="text-sm leading-5 text-red">{describeFailure(trips.error)}</p>;
  if (trips.data.length === 0) {
    return (
      <p className="text-sm leading-5 text-muted">
        No trips running. Starting a trip from here arrives with the map; the live map follows.
      </p>
    );
  }
  return (
    <div>
      <h2 className="text-xs leading-4 font-bold tracking-[1.5px] text-muted">YOUR TRIPS</h2>
      <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
        {trips.data.map((trip) => (
          <li key={trip.id}>
            <Link
              to={trip.role === 'host' ? `/trip/${trip.id}/invite` : `/trip/${trip.id}`}
              className="flex min-h-11 items-center justify-between gap-3 rounded-control bg-tint px-4 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate font-bold">{trip.name}</span>
                <span className="block text-xs leading-4 text-muted">
                  {trip.role === 'host' ? 'You host' : 'You joined'} · {trip.memberCount}{' '}
                  {trip.memberCount === 1 ? 'person' : 'people'}
                </span>
              </span>
              <span className="font-mono text-sm tracking-[1px] text-blue-d">{trip.code}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Temporary home. The real one (map, trips, bottom navigation) replaces it; until then it
 * confirms who is signed in and offers a way out, or a way in for people exploring.
 */
export function HomePage() {
  const navigate = useNavigate();
  const status = useSession((state) => state.status);
  const user = useSession((state) => state.user);
  const guest = useSession((state) => state.guest);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col justify-center gap-4 bg-sand px-5 py-8">
      <p className="flex items-center gap-2 font-extrabold">
        <Compass aria-hidden="true" className="size-6 text-blue" />
        SquadMap
      </p>

      {status === 'signedIn' && user ? (
        <section aria-labelledby="home-title" className="glass-strong flex flex-col gap-4 rounded-card p-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-12 flex-none items-center justify-center rounded-pill text-lg font-extrabold text-on-person"
              style={{ backgroundColor: user.color }}
            >
              {user.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1 id="home-title" className="truncate text-[22px] leading-7 font-extrabold">
                Hi, {user.name}
              </h1>
              <p className="truncate text-sm leading-5 text-muted">{user.email}</p>
            </div>
          </div>
          <YourTrips />
          <Button
            variant="glass"
            onClick={async () => {
              await signOut();
              navigate('/', { replace: true });
            }}
          >
            Log out
          </Button>
        </section>
      ) : status === 'guest' && guest ? (
        <section aria-labelledby="home-title" className="glass-strong flex flex-col gap-4 rounded-card p-5">
          <h1 id="home-title" className="text-[22px] leading-7 font-extrabold">
            You're on a trip
          </h1>
          <p className="text-sm leading-5 text-muted">
            You joined as {guest.displayName}, without an account. Your place lasts until the trip ends.
          </p>
          <ButtonLink to={`/trip/${guest.tripId}`}>Back to the trip</ButtonLink>
        </section>
      ) : (
        <section aria-labelledby="home-title" className="glass-strong flex flex-col gap-4 rounded-card p-5">
          <h1 id="home-title" className="text-[22px] leading-7 font-extrabold">
            {status === 'unknown' ? 'Loading…' : 'You are exploring'}
          </h1>
          <p className="text-sm leading-5 text-muted">
            Create an account to start a trip and invite friends, or log in if you already have one.
          </p>
          <ButtonLink to="/signup">Create account</ButtonLink>
          <ButtonLink to="/login" variant="glass">
            Log in
          </ButtonLink>
          <ButtonLink to="/join" variant="text">
            Join a trip with a code
          </ButtonLink>
        </section>
      )}
    </main>
  );
}
