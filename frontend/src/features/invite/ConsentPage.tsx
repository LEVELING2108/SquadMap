import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { Check, MapPin } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import mapLight from '../../assets/illustrations/map.svg';
import mapDark from '../../assets/illustrations/map-dark.svg';
import { ApiError } from '../../lib/api/ApiError';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { describeFailure } from '../auth/formErrors';
import { setGuest, useSession } from '../auth/session';
import { tripKeys } from '../trip/tripQueries';
import { expiredPath, joinTrip, normalizeCode } from './joinApi';

const promises = [
  'Only people with the trip link see you',
  'Sharing stops when the trip ends',
  // Places are held only while the trip runs; the account keeps just a summary of the trip.
  'Your location isn’t kept after the trip',
];

type LocationAnswer = 'granted' | 'denied' | 'unsupported';

/**
 * Asks the browser for location permission. The position itself is not used or kept here: the
 * live map reads it later, while the trip runs.
 */
function askForLocation(): Promise<LocationAnswer> {
  if (!('geolocation' in navigator)) return Promise.resolve('unsupported');
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      // Only an explicit refusal counts; a slow or missing fix still means the person said yes.
      (error) => resolve(error.code === error.PERMISSION_DENIED ? 'denied' : 'granted'),
      { maximumAge: 60_000, timeout: 15_000 },
    );
  });
}

const blockedMessages: Record<Exclude<LocationAnswer, 'granted'>, string> = {
  denied:
    'Location is blocked for this site. To share, allow location in your browser’s site settings and try again. You can also join and only see your friends.',
  unsupported: 'This browser can’t share your location. You can still join and see your friends.',
};

/**
 * Informed consent before joining: what sharing means, and an honest choice. Both answers join
 * the trip; only "Share my location" records consent and asks the browser for permission.
 */
export function ConsentPage() {
  const { code: rawCode = '' } = useParams();
  const code = normalizeCode(rawCode);
  const displayName = (useLocation().state as { displayName?: string } | null)?.displayName;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const status = useSession((state) => state.status);
  const asAccount = status === 'signedIn';
  const [blocked, setBlocked] = useState<Exclude<LocationAnswer, 'granted'>>();
  const [asking, setAsking] = useState(false);

  const join = useMutation({
    mutationFn: (shareLocation: boolean) =>
      joinTrip(code!, { displayName: asAccount ? undefined : displayName, shareLocation }, asAccount),
    onSuccess: async (joined) => {
      if (joined.accessToken) setGuest(joined);
      await queryClient.invalidateQueries({ queryKey: tripKeys.all });
      navigate(`/trip/${joined.tripId}`, { replace: true });
    },
    onError: (failure) => {
      if (failure instanceof ApiError && failure.code === 'TRIP_EXPIRED') {
        navigate(expiredPath(code!, failure.details.endedAt), { replace: true });
      }
    },
  });

  if (!code) return <Navigate to="/join" replace />;
  if (status === 'unknown') {
    return (
      <main aria-busy="true" className="flex min-h-dvh items-center justify-center bg-screen">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }
  // A guest needs a name, given on the previous screen; arriving here directly starts there.
  if (!asAccount && !displayName) return <Navigate to={`/join/${code}`} replace />;

  async function share() {
    setAsking(true);
    const answer = await askForLocation();
    setAsking(false);
    if (answer === 'granted') {
      setBlocked(undefined);
      join.mutate(true);
    } else {
      setBlocked(answer);
    }
  }

  const busy = asking || join.isPending;

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[600px] flex-col items-center justify-center overflow-hidden bg-screen px-6 py-8">
      <div aria-hidden="true" className="absolute inset-0">
        <img
          src={mapLight}
          alt=""
          className="size-full scale-105 object-cover blur-[3px] grayscale-[0.4] dark:hidden"
        />
        <img
          src={mapDark}
          alt=""
          className="hidden size-full scale-105 object-cover blur-[3px] grayscale-[0.4] dark:block"
        />
        <div className="absolute inset-0 bg-scrim" />
      </div>

      <section
        aria-labelledby="consent-title"
        aria-describedby="consent-summary"
        className="motion-rise glass-strong relative flex w-full max-w-[342px] flex-col items-center gap-3 rounded-sheet px-6 pt-6 pb-5 text-center"
      >
        <div aria-hidden="true" className="relative mb-1 flex size-24 items-center justify-center">
          <span className="motion-pulse absolute inset-0 rounded-pill bg-blue/35" />
          <span className="absolute inset-0 rounded-pill bg-blue/30" />
          <span className="relative flex size-16 items-center justify-center rounded-pill bg-blue text-on-primary">
            <MapPin className="size-7" />
          </span>
        </div>
        <h1 id="consent-title" className="text-[22px] leading-7 font-extrabold tracking-[-0.3px]">
          Share your live location?
        </h1>
        <p id="consent-summary" className="text-sm leading-5 text-muted">
          Friends on this trip can see where you are until it ends. You can stop any time.
        </p>

        <ul className="m-0 flex w-full list-none flex-col gap-2 p-0 text-left">
          {promises.map((promise) => (
            <li key={promise} className="flex items-center gap-3 text-sm leading-5">
              <span
                aria-hidden="true"
                className="flex size-10 flex-none items-center justify-center rounded-control bg-green-bg text-green"
              >
                <Check className="size-5" />
              </span>
              {promise}
            </li>
          ))}
        </ul>

        {blocked && <Banner tone="error">{blockedMessages[blocked]}</Banner>}
        {join.isError && !(join.error instanceof ApiError && join.error.code === 'TRIP_EXPIRED') && (
          <Banner tone="error">{describeFailure(join.error)}</Banner>
        )}

        <div className="mt-1 flex w-full flex-col gap-2">
          <Button onClick={() => void share()} disabled={busy}>
            {join.isPending && join.variables
              ? 'Joining…'
              : asking
                ? 'Waiting for your browser…'
                : 'Share my location'}
          </Button>
          <Button variant="text" onClick={() => join.mutate(false)} disabled={busy}>
            {join.isPending && !join.variables ? 'Joining…' : blocked ? 'Join without sharing' : 'Not now'}
          </Button>
          {join.error instanceof ApiError && join.error.code === 'VALIDATION_FAILED' && (
            <Link
              to={`/join/${code}`}
              className="flex h-11 items-center justify-center text-sm font-bold text-blue-d"
            >
              Change your name
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
