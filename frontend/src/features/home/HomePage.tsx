import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Link2, LocateFixed, Menu, Plane, Plus } from 'lucide-react';
import { BottomNav } from '../../components/ui/BottomNav';
import { ButtonLink } from '../../components/ui/Button';
import { DEFAULT_VIEW, type LatLng } from '../../lib/map/geo';
import { MapView } from '../../lib/map/MapView';
import { formatClock } from '../../lib/time';
import { describeFailure } from '../auth/formErrors';
import { useSession } from '../auth/session';
import { useRecentPlaces } from '../newTrip/placesApi';
import { useKnownLocation } from '../newTrip/useKnownLocation';
import { useSettings } from '../profile/settingsApi';
import { useActiveTrips } from '../trip/tripQueries';
import type { Trip } from '../trip/types';

/** Trips listed on the panel; more are a tap away in Trips. */
const PANEL_TRIPS = 3;

type Located =
  { kind: 'idle' } | { kind: 'locating' } | { kind: 'found'; at: LatLng } | { kind: 'failed'; why: string };

/** Asks the browser where the person is. Only ever called from a tap on the recenter button. */
function locate(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This browser can’t share your location.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) =>
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? 'Location is blocked for this site. Allow it in your browser’s site settings to see where you are.'
              : 'Couldn’t find where you are just now. Try again in a moment.',
          ),
        ),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
  });
}

/** Watches an element's height, so the map keeps its logo and credits above the panel covering it. */
function useHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setHeight(element.getBoundingClientRect().height));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, height] as const;
}

function friendsLabel(trip: Trip): string {
  const others = trip.memberCount - 1;
  if (others <= 0) return 'Just you so far';
  return others === 1 ? '1 friend' : `${others} friends`;
}

function LiveTrips() {
  const trips = useActiveTrips(true);
  const { settings } = useSettings();
  if (trips.isPending) return <p className="text-sm leading-5 text-muted">Loading your trips…</p>;
  if (trips.isError) return <p className="text-sm leading-5 text-red">{describeFailure(trips.error)}</p>;
  if (trips.data.length === 0) return null;

  const shown = trips.data.slice(0, PANEL_TRIPS);
  return (
    <div className="flex flex-col gap-1">
      <h2 className="sr-only">Your live trips</h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {shown.map((trip) => (
          <li key={trip.id}>
            <Link
              to={trip.role === 'host' ? `/trip/${trip.id}/invite` : `/trip/${trip.id}`}
              className="flex min-h-[60px] items-center gap-3.5 py-2"
            >
              <span
                aria-hidden="true"
                className="flex size-11 flex-none items-center justify-center rounded-control bg-green-bg"
              >
                <span className="size-3 rounded-pill bg-green" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base leading-[22px] font-bold">{trip.name}</span>
                <span className="block truncate text-[13px] leading-[18px] text-muted">
                  Live now · {friendsLabel(trip)} · until {formatClock(trip.expiresAt, settings.timeFormat)}
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-5 flex-none text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      {trips.data.length > PANEL_TRIPS && (
        <Link to="/me/history" className="flex h-11 items-center text-sm font-bold text-blue-d">
          See all {trips.data.length} live trips
        </Link>
      )}
    </div>
  );
}

/**
 * The starting point: a map around you, a way to start or join a trip, and your trips running now.
 * It never asks for location by itself; the recenter button does, when tapped.
 */
export function HomePage() {
  const status = useSession((state) => state.status);
  const user = useSession((state) => state.user);
  const guest = useSession((state) => state.guest);
  const signedIn = status === 'signedIn' && user !== null;
  const known = useKnownLocation();
  const recent = useRecentPlaces(signedIn);
  const [located, setLocated] = useState<Located>({ kind: 'idle' });
  const [panelRef, panelHeight] = useHeight<HTMLElement>();

  const you = located.kind === 'found' ? located.at : known;
  // Where you are if known; otherwise the area of your last trip; otherwise most of India.
  const lastPlace = recent.data?.[0];
  const view = you
    ? { center: you, zoom: 15 }
    : lastPlace
      ? { center: { lat: lastPlace.lat, lng: lastPlace.lng }, zoom: 11 }
      : DEFAULT_VIEW;

  async function recenter() {
    setLocated({ kind: 'locating' });
    try {
      setLocated({ kind: 'found', at: await locate() });
    } catch (error) {
      setLocated({
        kind: 'failed',
        why: error instanceof Error ? error.message : 'Couldn’t find where you are.',
      });
    }
  }

  // The panel sits above the navigation bar, which is about 96 px tall.
  const navSpace = signedIn ? 96 : 16;

  return (
    <main className="relative mx-auto h-dvh w-full max-w-[600px] overflow-hidden bg-screen">
      <MapView
        center={view.center}
        zoom={view.zoom}
        you={you}
        interactive
        label={you ? 'Map around where you are' : 'Map'}
        bottomInset={panelHeight + navSpace + 8}
        // The top bar and the panel cover the map's edges; centre on what's left between them.
        padding={{ top: 88, bottom: panelHeight + navSpace }}
        className="absolute inset-0"
      />

      <div className="absolute inset-x-0 top-0 z-10 px-3 pt-3">
        <div className="glass-strong flex h-16 items-center gap-1 rounded-pill pr-2 pl-1">
          <Link
            to={signedIn ? '/me/settings' : '/login'}
            aria-label={signedIn ? 'Settings' : 'Log in'}
            className="flex size-12 flex-none items-center justify-center rounded-pill text-ink"
          >
            <Menu aria-hidden="true" className="size-6" />
          </Link>
          <Link
            to={signedIn ? '/trip/new/destination' : '/login'}
            className="flex min-h-12 min-w-0 flex-1 flex-col justify-center px-1"
          >
            <span className="truncate text-base leading-[22px] font-extrabold">Where to?</span>
            <span className="truncate text-[13px] leading-[18px] text-muted">
              {signedIn ? 'Search a place or trip' : 'Log in to plan a trip'}
            </span>
          </Link>
          {signedIn && (
            <Link
              to="/me"
              aria-label={`Your profile, ${user.name}`}
              className="flex size-12 flex-none items-center justify-center rounded-pill text-lg font-extrabold text-on-person"
              style={{ backgroundColor: user.color }}
            >
              {user.name.charAt(0).toUpperCase()}
            </Link>
          )}
        </div>
      </div>

      <div
        className="absolute right-3 z-10 flex flex-col items-end gap-2"
        // Above Mapbox's credits button, which sits in the map's bottom-right corner.
        style={{ bottom: panelHeight + navSpace + 48 }}
      >
        {located.kind === 'failed' && (
          <p
            role="alert"
            className="glass-strong max-w-[260px] rounded-card px-3 py-2 text-[13px] leading-[18px] font-semibold text-red"
          >
            {located.why}
          </p>
        )}
        <button
          type="button"
          onClick={() => void recenter()}
          aria-label="Show where I am"
          aria-busy={located.kind === 'locating'}
          className="glass-strong flex size-14 items-center justify-center rounded-pill text-ink"
        >
          <LocateFixed
            aria-hidden="true"
            className={`size-6 ${located.kind === 'locating' ? 'animate-pulse' : ''}`}
          />
        </button>
      </div>

      <section
        ref={panelRef}
        aria-labelledby="home-title"
        className="glass-strong absolute inset-x-3 z-10 flex max-h-[55dvh] flex-col gap-3 overflow-y-auto rounded-sheet px-5 pt-3 pb-4"
        style={{ bottom: navSpace }}
      >
        <div aria-hidden="true" className="mx-auto h-1 w-10 flex-none rounded-[2px] bg-handle" />

        {status === 'unknown' ? (
          <h1 id="home-title" className="text-[22px] leading-7 font-extrabold">
            Loading…
          </h1>
        ) : status === 'guest' && guest ? (
          <>
            <div>
              <h1 id="home-title" className="text-[22px] leading-7 font-extrabold">
                You’re on a trip
              </h1>
              <p className="text-sm leading-5 text-muted">
                You joined as {guest.displayName}, without an account. Your place lasts until the trip ends.
              </p>
            </div>
            <ButtonLink to={`/trip/${guest.tripId}`}>Back to your trip</ButtonLink>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 id="home-title" className="text-[24px] leading-[30px] font-extrabold tracking-[-0.3px]">
                  Ready for a trip?
                </h1>
                <p className="text-sm leading-5 text-muted">
                  {signedIn
                    ? 'Start one or join friends.'
                    : 'Make an account to start trips, or join friends with a code.'}
                </p>
              </div>
              <Plane aria-hidden="true" className="mt-1 size-8 flex-none text-coral" />
            </div>

            {signedIn ? (
              <>
                <div className="grid grid-cols-[1.25fr_1fr] gap-3">
                  <ButtonLink to="/trip/new/destination">
                    <Plus aria-hidden="true" className="size-5" />
                    New trip
                  </ButtonLink>
                  <ButtonLink to="/join" variant="glass">
                    <Link2 aria-hidden="true" className="size-5" />
                    Join
                  </ButtonLink>
                </div>
                <LiveTrips />
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <ButtonLink to="/signup">Create account</ButtonLink>
                  <ButtonLink to="/login" variant="glass">
                    Log in
                  </ButtonLink>
                </div>
                <ButtonLink to="/join" variant="text">
                  Join a trip with a code
                </ButtonLink>
              </>
            )}
          </>
        )}
      </section>

      {signedIn && <BottomNav />}
    </main>
  );
}
