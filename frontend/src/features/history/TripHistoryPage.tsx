import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Plane } from 'lucide-react';
import { BackButton } from '../../components/ui/BackButton';
import { Banner } from '../../components/ui/Banner';
import { BOTTOM_NAV_SPACE, BottomNav } from '../../components/ui/BottomNav';
import { Button, ButtonLink } from '../../components/ui/Button';
import { MapThumb } from '../../lib/map/MapThumb';
import { formatClock } from '../../lib/time';
import { useSettings } from '../profile/settingsApi';
import { describeFailure } from '../auth/formErrors';
import {
  friendsLabel,
  isThisMonth,
  topFriend,
  useTripHistory,
  whenLabel,
  type HistoryTrip,
} from './historyApi';

type Filter = 'all' | 'month' | 'friend';

function Badge({ live }: { live: boolean }) {
  return (
    <span
      className={`flex-none rounded-pill px-3 py-1 text-[13px] leading-[18px] font-bold ${
        live ? 'bg-tint text-blue-d' : 'bg-green-bg text-green'
      }`}
    >
      {live ? 'Live' : 'Done'}
    </span>
  );
}

function TripCard({ trip }: { trip: HistoryTrip }) {
  const live = trip.status === 'active';
  const { settings } = useSettings();
  const when = live
    ? `Live until ${formatClock(trip.expiresAt, settings.timeFormat)}`
    : whenLabel(trip.startsAt);
  const details = `${when} · ${friendsLabel(trip)}`;

  const body = (
    <>
      {trip.destination && <MapThumb center={trip.destination} className="w-full" />}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {!trip.destination && (
          <span
            aria-hidden="true"
            className="flex size-10 flex-none items-center justify-center rounded-control bg-sea-bg text-sea-d"
          >
            <Plane className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base leading-[22px] font-bold">{trip.name}</h2>
          <p className="truncate text-[13px] leading-[18px] text-muted">{details}</p>
        </div>
        <Badge live={live} />
      </div>
    </>
  );

  // A running trip opens; a finished one has nothing to open until trip summaries exist.
  return (
    <li>
      {live ? (
        <Link
          to={trip.role === 'host' ? `/trip/${trip.id}/invite` : `/trip/${trip.id}`}
          className="glass-strong block overflow-hidden rounded-card"
        >
          {body}
        </Link>
      ) : (
        <article className="glass-strong overflow-hidden rounded-card">{body}</article>
      )}
    </li>
  );
}

/** Every trip you hosted or joined, newest first. */
export function TripHistoryPage() {
  const history = useTripHistory();
  const [filter, setFilter] = useState<Filter>('all');
  const trips = useMemo(() => history.data?.pages.flatMap((page) => page.items) ?? [], [history.data]);
  const friend = useMemo(() => topFriend(trips), [trips]);

  // If the friend filter's name disappears (it can't today, but data may reload), fall back to all.
  const active: Filter = filter === 'friend' && !friend ? 'all' : filter;
  const shown = trips.filter((trip) => {
    if (active === 'month') return isThisMonth(trip.startsAt);
    if (active === 'friend') return friend !== null && trip.friends.includes(friend);
    return true;
  });

  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'month', label: 'This month' },
    ...(friend ? [{ id: 'friend' as const, label: `With ${friend}` }] : []),
  ];

  return (
    <main
      className={`mx-auto flex min-h-dvh w-full max-w-[600px] flex-col gap-4 bg-sand px-3 pt-3 ${BOTTOM_NAV_SPACE}`}
    >
      <header className="flex items-center gap-2">
        <BackButton fallback="/home" className="bg-transparent shadow-none" />
        <h1 className="text-[22px] leading-7 font-extrabold tracking-[-0.3px]">Trip history</h1>
      </header>

      {trips.length > 0 && (
        <div role="group" aria-label="Filter trips" className="flex flex-wrap gap-2">
          {filters.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={active === id}
              onClick={() => setFilter(id)}
              className={`h-11 rounded-pill px-4 text-[15px] font-bold ${
                active === id ? 'bg-blue text-on-primary' : 'glass-strong text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {history.isPending && (
        <p role="status" className="px-2 text-sm leading-5 text-muted">
          Loading your trips…
        </p>
      )}
      {history.isError && <Banner tone="error">{describeFailure(history.error)}</Banner>}

      {history.isSuccess && trips.length === 0 && (
        <section className="glass-strong flex flex-col gap-3 rounded-card p-5">
          <h2 className="text-base leading-[22px] font-bold">No trips yet</h2>
          <p className="text-sm leading-5 text-muted">Trips you start or join show up here.</p>
          <ButtonLink to="/trip/new/destination">New trip</ButtonLink>
        </section>
      )}

      {trips.length > 0 && shown.length === 0 && (
        <p role="status" className="px-2 text-sm leading-5 text-muted">
          No trips match this filter.
        </p>
      )}

      {shown.length > 0 && (
        <ul aria-label="Trips" className="m-0 flex list-none flex-col gap-3 p-0">
          {shown.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </ul>
      )}

      {history.hasNextPage && (
        <Button
          variant="glass"
          onClick={() => void history.fetchNextPage()}
          disabled={history.isFetchingNextPage}
        >
          {history.isFetchingNextPage ? 'Loading…' : 'Show older trips'}
        </Button>
      )}

      <BottomNav />
    </main>
  );
}
