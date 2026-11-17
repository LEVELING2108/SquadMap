import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LocateFixed, Maximize, WifiOff } from 'lucide-react';
import { api } from '../../lib/api/client';
import { ApiError } from '../../lib/api/ApiError';
import { DEFAULT_VIEW, type LatLng } from '../../lib/map/geo';
import { MapView, type MapPerson, type MapRoute } from '../../lib/map/MapView';
import { decodePolyline } from '../../lib/map/polyline';
import { useElementHeight } from '../../lib/useElementHeight';
import { Banner } from '../../components/ui/Banner';
import { ButtonLink } from '../../components/ui/Button';
import { describeFailure } from '../auth/formErrors';
import { refreshSession, signOut, useSession } from '../auth/session';
import { useSettings } from '../profile/settingsApi';
import { shortPlace, tripKeys, useTrip } from '../trip/tripQueries';
import { EtaList } from './EtaList';
import { liveKeys, useLiveMembers, useStartSharing, useTripEtas } from './liveApi';
import { timeLeft, staleLabel } from './liveFormat';
import {
  applyEta,
  applyLocation,
  clearPositions,
  forgetEta,
  forgetMember,
  openTrip,
  seedEtas,
  seedPositions,
  useLiveStore,
} from './liveStore';
import type { LiveError, TripEvent } from './liveTypes';
import { LivePeekSheet } from './LivePeekSheet';
import { LiveTopBar } from './LiveTopBar';
import { ShareLocationCard } from './ShareLocationCard';
import { TripEndedCard } from './TripEndedCard';
import { useLocationSharing } from './useLocationSharing';
import { useTripSocket } from './useTripSocket';

/** Re-renders every so often, so "Live · 3 h left" and "2 min ago" stay true. */
function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/** What a trip event says to everyone, in a short toast. */
function announce(event: TripEvent): string | null {
  const who = event.displayName ?? 'Someone';
  switch (event.type) {
    case 'MEMBER_JOINED':
      return `${who} joined the trip`;
    case 'MEMBER_LEFT':
      return `${who} left the trip`;
    case 'SHARING_STARTED':
      return `${who} is sharing their location`;
    case 'TRIP_EXTENDED':
      return 'The host added more time';
    default:
      return null;
  }
}

/** A colour from the theme as Mapbox needs it (a real value, not a CSS variable). */
function themeColor(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * The live map (D1): everyone on the trip moving on one map, in real time. It loads who is on the trip,
 * keeps a live connection for their moves, and shares this phone's location once the person has agreed.
 * With `view="eta"` (D3) the sheet lists who's on the way; the map and connection stay the same.
 */
export function LiveMapPage({ view = 'map' }: { view?: 'map' | 'eta' }) {
  const { tripId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const status = useSession((state) => state.status);
  const trip = useTrip(tripId);
  const [ended, setEnded] = useState(false);
  const tripOver = ended || (trip.data !== undefined && trip.data.status !== 'active');
  const members = useLiveMembers(tripId, !tripOver);
  const etaSnapshot = useTripEtas(tripId, !tripOver);
  const positions = useLiveStore((state) => state.positions);
  const etas = useLiveStore((state) => state.etas);
  const now = useNow(15_000);
  const [toast, setToast] = useState<string | null>(null);
  const startSharing = useStartSharing(tripId);
  const { settings } = useSettings();

  useEffect(() => openTrip(tripId), [tripId]);
  useEffect(() => {
    if (members.data) seedPositions(members.data);
  }, [members.data]);
  useEffect(() => {
    if (etaSnapshot.data) seedEtas(etaSnapshot.data);
  }, [etaSnapshot.data]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4_000);
    return () => clearTimeout(timer);
  }, [toast]);

  const refreshMembers = () => void queryClient.invalidateQueries({ queryKey: liveKeys.members(tripId) });
  const destinationName = trip.data?.destination ? shortPlace(trip.data.destination.name) : null;

  function endTrip() {
    setEnded(true);
    clearPositions();
    void queryClient.invalidateQueries({ queryKey: tripKeys.one(tripId) });
  }

  const socket = useTripSocket(tripId, trip.data?.status === 'active' && !ended, {
    onLocation: applyLocation,
    onEta: applyEta,
    onEvent: (event) => {
      if (event.type === 'TRIP_ENDED') {
        endTrip();
        return;
      }
      if (event.type === 'ARRIVED') {
        if (event.memberId) forgetEta(event.memberId);
        refreshMembers();
        const isMe = members.data?.some((member) => member.you && member.memberId === event.memberId);
        const where = destinationName ? ` at ${destinationName}` : '';
        setToast(isMe ? `You arrived${where}` : `${event.displayName ?? 'Someone'} arrived${where}`);
        return;
      }
      if (event.type === 'MEMBER_LEFT' && event.memberId) forgetMember(event.memberId);
      if (event.type === 'TRIP_EXTENDED') {
        void queryClient.invalidateQueries({ queryKey: tripKeys.one(tripId) });
        // A guest's pass runs to the old end time; a fresh one covers the extra time.
        if (status === 'guest') void refreshSession();
      } else {
        refreshMembers();
      }
      const isMe = members.data?.some((member) => member.you && member.memberId === event.memberId);
      const words = isMe ? null : announce(event);
      if (words) setToast(words);
    },
    onError: (error: LiveError) => {
      if (error.code === 'NOT_SHARING') refreshMembers();
      if (error.code === 'TRIP_EXPIRED') endTrip();
    },
    onReconnected: () => {
      refreshMembers();
      void queryClient.invalidateQueries({ queryKey: liveKeys.etas(tripId) });
    },
    onRefused: (code) => {
      if (code === 'TRIP_EXPIRED') endTrip();
      else if (code === 'TRIP_NOT_FOUND' || code === 'UNAUTHENTICATED') navigate('/', { replace: true });
    },
  });

  const me = members.data?.find((member) => member.you);
  const friends = useMemo(() => (members.data ?? []).filter((member) => !member.you), [members.data]);
  const { sharing, you } = useLocationSharing({
    enabled: !tripOver && me?.sharing === true,
    connected: socket.connection === 'live',
    send: socket.send,
  });

  // A guest leaving ends their pass, so this device forgets them; a member goes back home.
  const leave = useMutation({
    mutationFn: () => api<void>(`/trips/${encodeURIComponent(tripId)}/members/me`, { method: 'DELETE' }),
    onSuccess: async () => {
      if (status === 'guest') {
        await signOut();
        navigate('/', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    },
  });

  // Where the map looks: the destination at first, everyone once they are known, you on request.
  const destination = trip.data?.destination ?? null;
  const youSpot: LatLng | null = you ?? (me ? (positions[me.memberId] ?? null) : null);
  const [fitCount, setFitCount] = useState(0);
  const [focus, setFocus] = useState<{ at: LatLng; times: number } | null>(null);

  const people: MapPerson[] = tripOver
    ? []
    : friends.flatMap((friend) => {
        const spot = positions[friend.memberId];
        if (!friend.sharing || !spot) return [];
        return [
          {
            id: friend.memberId,
            lat: spot.lat,
            lng: spot.lng,
            name: friend.displayName,
            color: friend.color,
            stale: staleLabel(spot.ts, now) ?? undefined,
            arrived: friend.arrivedAt !== null,
          },
        ];
      });
  // Each route in its person's colour; yours in the "You" blue, like your dot.
  const routes: MapRoute[] = tripOver
    ? []
    : (members.data ?? []).flatMap((member) => {
        const eta = etas[member.memberId];
        if (!eta?.route || member.arrivedAt) return [];
        const color = member.you ? themeColor('--you', '#1A73E8') : member.color;
        return [{ id: member.memberId, color, points: decodePolyline(eta.route) }];
      });
  const everyone: LatLng[] = [
    ...people.map(({ lat, lng }) => ({ lat, lng })),
    ...(youSpot && !tripOver ? [youSpot] : []),
    ...(destination ? [destination] : []),
  ];
  // The map shows everyone again when someone appears on it or leaves it (a friend's first spot, your own),
  // or on a "Show everyone" tap; plain moves never re-frame it, so browsing the map isn't interrupted.
  const fitKey = [
    fitCount,
    people.map((person) => person.id).join(','),
    youSpot && !tripOver ? 'you' : '',
    destination ? 'destination' : '',
  ].join('|');

  const [sheetRef, sheetHeight] = useElementHeight<HTMLElement>();
  const center = focus?.at ?? destination ?? DEFAULT_VIEW.center;
  const zoom = focus ? 16 : destination ? 13 : DEFAULT_VIEW.zoom;

  const notFound = trip.error instanceof ApiError && trip.error.status === 404;
  useEffect(() => {
    if (notFound) navigate('/', { replace: true });
  }, [notFound, navigate]);

  const code = trip.data?.code ?? '········';
  const statusText = tripOver
    ? 'Ended'
    : socket.connection === 'live' && trip.data
      ? `Live · ${timeLeft(trip.data.expiresAt, now)}`
      : socket.connection === 'offline'
        ? 'Offline'
        : 'Connecting…';

  return (
    <main className="relative mx-auto h-dvh w-full max-w-[600px] overflow-hidden bg-screen">
      <MapView
        center={center}
        zoom={zoom}
        recenterKey={focus?.times ?? 0}
        label={
          trip.data?.destination
            ? `Live map of the trip to ${trip.data.destination.name}`
            : `Live map of ${trip.data?.name ?? 'the trip'}`
        }
        interactive
        destination={destination}
        you={tripOver ? null : youSpot}
        people={people}
        routes={routes}
        fitTo={everyone}
        fitKey={fitKey}
        bottomInset={sheetHeight + 20}
        padding={{ top: 88, bottom: sheetHeight + 12 }}
        className={`absolute inset-0 ${socket.connection === 'offline' ? 'grayscale' : ''}`}
      />

      <LiveTopBar
        code={code}
        status={statusText}
        live={!tripOver && socket.connection === 'live'}
        back={
          view === 'eta'
            ? { to: `/trip/${tripId}`, label: 'Back to the map' }
            : status === 'signedIn'
              ? { to: '/home', label: 'Back to home' }
              : null
        }
        showHome={status === 'signedIn'}
        isHost={trip.data?.role === 'host'}
        tripId={tripId}
        onLeave={trip.data && trip.data.role !== 'host' && !tripOver ? () => leave.mutate() : undefined}
        leaving={leave.isPending}
      />

      <div className="absolute inset-x-0 top-[88px] z-10 flex flex-col items-center gap-2 px-3">
        <div aria-live="polite" className="contents">
          {toast && (
            <p className="glass-strong flex items-center gap-2 rounded-pill px-4 py-2 text-[15px] font-bold text-ink">
              <span aria-hidden="true" className="size-2.5 rounded-pill bg-green" />
              {toast}
            </p>
          )}
        </div>
        {!tripOver && socket.connection === 'offline' && (
          <div
            role="status"
            className="flex w-full items-center gap-3 rounded-card bg-amber-bg px-4 py-3 text-[13px] leading-[18px] font-bold text-amber"
          >
            <WifiOff aria-hidden="true" className="size-5 flex-none" />
            <span className="flex-1">No connection, showing last known spots</span>
            <button
              type="button"
              onClick={socket.retry}
              className="min-h-11 rounded-pill px-3 text-[13px] font-extrabold underline"
            >
              Retry
            </button>
          </div>
        )}
        {leave.isError && <Banner tone="error">{describeFailure(leave.error)}</Banner>}
      </div>

      {!tripOver && (
        <div
          className="absolute right-3 z-10 flex flex-col gap-2"
          // Above Mapbox's credits button, which sits in the map's bottom-right corner.
          style={{ bottom: sheetHeight + 56 }}
        >
          <button
            type="button"
            aria-label="Show where I am"
            disabled={!youSpot}
            onClick={() => youSpot && setFocus((last) => ({ at: youSpot, times: (last?.times ?? 0) + 1 }))}
            className="glass-strong flex size-14 items-center justify-center rounded-pill text-ink disabled:opacity-50"
          >
            <LocateFixed aria-hidden="true" className="size-6" />
          </button>
          <button
            type="button"
            aria-label="Show everyone"
            disabled={everyone.length === 0}
            onClick={() => setFitCount((count) => count + 1)}
            className="glass-strong flex size-14 items-center justify-center rounded-pill text-ink disabled:opacity-50"
          >
            <Maximize aria-hidden="true" className="size-6" />
          </button>
        </div>
      )}

      {tripOver ? (
        <section
          ref={sheetRef}
          aria-labelledby="live-title"
          className="glass-strong absolute inset-x-3 bottom-3 z-10 rounded-sheet px-5 pt-5 pb-4"
        >
          <TripEndedCard
            guest={status === 'guest'}
            onDone={() => void signOut().then(() => navigate('/', { replace: true }))}
          />
        </section>
      ) : (
        <LivePeekSheet
          ref={sheetRef}
          friends={friends}
          positions={positions}
          etas={etas}
          now={now}
          code={code}
          listHref={`/trip/${tripId}/eta`}
          destination={destinationName}
          expanded={
            view === 'eta' && members.data ? (
              <EtaList
                members={members.data}
                etas={etas}
                destination={destinationName}
                unit={settings.distanceUnit}
                inviteHref={trip.data?.role === 'host' ? `/trip/${tripId}/invite` : null}
              />
            ) : undefined
          }
        >
          {members.isError && <Banner tone="error">{describeFailure(members.error)}</Banner>}
          {me && !me.sharing && (
            <ShareLocationCard
              onShare={() => startSharing.mutate()}
              pending={startSharing.isPending}
              error={startSharing.error}
            />
          )}
          {sharing.kind === 'denied' && (
            <Banner tone="error">
              Location is blocked for this site, so friends can’t see you. Allow location for this site in
              your browser’s settings, then reload.
            </Banner>
          )}
          {sharing.kind === 'unavailable' && (
            <Banner tone="error">This browser can’t share its location. Friends can’t see you here.</Banner>
          )}
          {view === 'map' && trip.data?.role === 'host' && friends.length === 0 && (
            <ButtonLink to={`/trip/${tripId}/invite`} variant="glass">
              Show the invite
            </ButtonLink>
          )}
        </LivePeekSheet>
      )}
    </main>
  );
}
