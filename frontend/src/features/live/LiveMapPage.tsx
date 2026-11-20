import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LocateFixed, MapPinOff, Maximize, MessageSquare, WifiOff } from 'lucide-react';
import { api } from '../../lib/api/client';
import { ApiError } from '../../lib/api/ApiError';
import { DEFAULT_VIEW, type LatLng } from '../../lib/map/geo';
import { MapView, type MapPerson, type MapRoute } from '../../lib/map/MapView';
import { decodePolyline } from '../../lib/map/polyline';
import { useElementHeight } from '../../lib/useElementHeight';
import { Banner } from '../../components/ui/Banner';
import { ButtonLink } from '../../components/ui/Button';
import { describeFailure } from '../auth/formErrors';
import { formatClock } from '../../lib/time';
import { addMessage, chatKeys, unreadOf, useChatMessages } from '../chat/chatApi';
import { TripChat } from '../chat/TripChat';
import { useTyping } from '../chat/useTyping';
import { refreshSession, signOut, useSession } from '../auth/session';
import { useSettings, useUpdateSettings, type MapStyle } from '../profile/settingsApi';
import { useTripSummary } from '../trip/summaryApi';
import { shortPlace, tripKeys, useTrip } from '../trip/tripQueries';
import type { Trip } from '../trip/types';
import { EndTripDialog } from './EndTripDialog';
import { ExpiryWarning } from './ExpiryWarning';
import { ExtendDialog } from './ExtendDialog';
import { LeaveTripDialog } from './LeaveTripDialog';
import { TripMenu } from './TripMenu';
import { WARN_BEFORE_MS } from './tripActions';
import { EtaList } from './EtaList';
import { FriendDetails } from './FriendDetails';
import { LayersControl } from './LayersControl';
import {
  liveKeys,
  useChooseTravelMode,
  useLiveMembers,
  useSetPaused,
  useStartSharing,
  useTripEtas,
} from './liveApi';
import { TravelModePicker } from './TravelModePicker';
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
import { ArrivedSheet } from './ArrivedSheet';
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

/** Remembers on this device that the warning for this end time was dismissed, so a reload doesn't repeat it. */
const DISMISSED_KEY = 'squadmap.expiryWarningDismissed';

function readDismissed(): string | null {
  try {
    return sessionStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

function saveDismissed(key: string) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, key);
  } catch {
    // Without storage the warning may show again after a reload, which is harmless.
  }
}

/** "You made it!" shows once per trip on this device; later arrivals (after leaving the spot) are a toast. */
const ARRIVED_KEY = 'squadmap.arrivedShown';

function firstArrival(tripId: string): boolean {
  try {
    if (sessionStorage.getItem(ARRIVED_KEY) === tripId) return false;
    sessionStorage.setItem(ARRIVED_KEY, tripId);
  } catch {
    // Without storage it may show again after a reload, which is harmless.
  }
  return true;
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
    case 'PAUSED':
      return `${who} paused their location`;
    case 'RESUMED':
      return `${who} is sharing again`;
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
 * With `view="eta"` (D3) the sheet lists who's on the way, with `view="friend"` (D2) one friend's details,
 * with `view="chat"` (D4) the trip chat, with `view="menu"` (D5) the trip menu, and with `view="arrived"`
 * (E3) "You made it!"; the map and connection stay the same. Once the trip is over it moves on to Trip
 * complete (E5).
 */
export function LiveMapPage({
  view = 'map',
}: {
  view?: 'map' | 'eta' | 'friend' | 'chat' | 'menu' | 'arrived';
}) {
  const { tripId = '', memberId } = useParams();
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
  const setPaused = useSetPaused(tripId);
  const chooseMode = useChooseTravelMode(tripId);
  const { settings } = useSettings();
  const chatOn = trip.data?.chatEnabled === true;
  const chat = useChatMessages(tripId, chatOn);
  const unread = view === 'chat' ? 0 : unreadOf(chat.data);
  const { typingIds, noteTyping, stopTyping } = useTyping();
  const isHost = trip.data?.role === 'host';
  const [dialog, setDialog] = useState<'extend' | 'end' | 'leave' | null>(null);
  const [dismissedWarning, setDismissedWarning] = useState<string | null>(readDismissed);

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
    onChat: (event) => {
      const myId = members.data?.find((member) => member.you)?.memberId;
      if (event.type === 'TYPING') {
        if (event.memberId !== myId) noteTyping(event.memberId);
        return;
      }
      stopTyping(event.message.memberId);
      // Unread when it's someone else's and the chat isn't open.
      addMessage(queryClient, tripId, event.message, event.message.memberId !== myId && view !== 'chat');
    },
    onEvent: (event) => {
      if (event.type === 'TRIP_ENDED') {
        endTrip();
        return;
      }
      // A paused friend's ETA is gone on the server too; their dot stays where they paused.
      if (event.type === 'PAUSED' && event.memberId) forgetEta(event.memberId);
      if (event.type === 'ARRIVED') {
        if (event.memberId) forgetEta(event.memberId);
        refreshMembers();
        const isMe = members.data?.some((member) => member.you && member.memberId === event.memberId);
        const where = destinationName ? ` at ${destinationName}` : '';
        if (isMe && destinationName && firstArrival(tripId)) {
          navigate(`/trip/${tripId}/arrived`);
          return;
        }
        setToast(isMe ? `You arrived${where}` : `${event.displayName ?? 'Someone'} arrived${where}`);
        return;
      }
      const isMe = members.data?.some((member) => member.you && member.memberId === event.memberId);
      // Hearing that you left: this page is on its way out, and the trip is no longer yours to read.
      if (event.type === 'MEMBER_LEFT' && isMe) return;
      if (event.type === 'MEMBER_LEFT' && event.memberId) forgetMember(event.memberId);
      if (event.type === 'TRIP_EXTENDED') {
        void queryClient.invalidateQueries({ queryKey: tripKeys.one(tripId) });
        // A guest's pass runs to the old end time; a fresh one covers the extra time.
        if (status === 'guest') void refreshSession();
      } else {
        refreshMembers();
      }
      // The host who added time has already been told.
      const words = isMe || (event.type === 'TRIP_EXTENDED' && isHost) ? null : announce(event);
      if (words) setToast(words);
    },
    onError: (error: LiveError) => {
      if (error.code === 'NOT_SHARING') refreshMembers();
      if (error.code === 'TRIP_EXPIRED') endTrip();
    },
    onReconnected: () => {
      refreshMembers();
      void queryClient.invalidateQueries({ queryKey: liveKeys.etas(tripId) });
      // Messages sent while the connection was down.
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(tripId) });
    },
    onRefused: (code) => {
      if (code === 'TRIP_EXPIRED') endTrip();
      else if (code === 'TRIP_NOT_FOUND' || code === 'UNAUTHENTICATED') navigate('/', { replace: true });
    },
  });

  const me = members.data?.find((member) => member.you);
  const friends = useMemo(() => (members.data ?? []).filter((member) => !member.you), [members.data]);
  const arrivedSummary = useTripSummary(tripId, view === 'arrived' && !tripOver);
  // Friends still on the way, in whole minutes, for "Everyone else is 1 to 12 min behind".
  const behindMinutes = friends
    .filter((friend) => !friend.arrivedAt && etas[friend.memberId])
    .map((friend) => Math.round((etas[friend.memberId]?.durationS ?? 0) / 60));
  const { sharing, you } = useLocationSharing({
    // Paused: no location is read at all, not just not sent.
    enabled: !tripOver && me?.sharing === true && !me.pausedAt,
    connected: socket.connection === 'live',
    send: socket.send,
    // Accounts that turned precise location off send a rough area; guests share as they agreed on joining.
    approximate: status === 'signedIn' && !settings.preciseLocation,
  });

  // A guest leaving ends their pass, so this device forgets them; a member goes back home.
  const leave = useMutation<void, Error, { finish: boolean }>({
    mutationFn: () => api<void>(`/trips/${encodeURIComponent(tripId)}/members/me`, { method: 'DELETE' }),
    onSuccess: async (_data, how) => {
      // Finishing from "You made it!" shows how the trip went; the guest's pass still reads it.
      if (how.finish) {
        navigate(`/trip/${tripId}/ended`, { replace: true });
      } else if (status === 'guest') {
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

  // A friend's details: the map goes to them once when opened, and keeps them in the middle while followed.
  const friend =
    view === 'friend'
      ? members.data?.find((member) => member.memberId === memberId && !member.you)
      : undefined;
  const friendSpot = friend ? positions[friend.memberId] : undefined;
  const [framedFriend, setFramedFriend] = useState<string | null>(null);
  if (friend && friendSpot && framedFriend !== friend.memberId) {
    setFramedFriend(friend.memberId);
    setFocus((last) => ({ at: { lat: friendSpot.lat, lng: friendSpot.lng }, times: (last?.times ?? 0) + 1 }));
  }
  if (view !== 'friend' && framedFriend !== null) setFramedFriend(null);
  const [followId, setFollowId] = useState<string | null>(null);
  const following = friend !== undefined && friendSpot !== undefined && followId === friend.memberId;

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
            stale: friend.pausedAt ? 'Paused' : (staleLabel(spot.ts, now) ?? undefined),
            arrived: friend.arrivedAt !== null,
            selected: view === 'friend' && friend.memberId === memberId,
            approximate: spot.approx === true,
          },
        ];
      });
  // Each route in its person's colour; yours in the "You" blue, like your dot.
  const routes: MapRoute[] = tripOver
    ? []
    : (members.data ?? []).flatMap((member) => {
        const eta = etas[member.memberId];
        if (!eta?.route || member.arrivedAt || member.pausedAt) return [];
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
  const center = following && friendSpot ? friendSpot : (focus?.at ?? destination ?? DEFAULT_VIEW.center);
  const zoom = following || focus ? 16 : destination ? 13 : DEFAULT_VIEW.zoom;

  // Layers: an account's choice is its map-style setting; a guest's lasts while they are on this page.
  const updateSettings = useUpdateSettings();
  const [guestStyle, setGuestStyle] = useState<MapStyle | undefined>(undefined);
  const mapStyle = status === 'signedIn' ? settings.mapStyle : (guestStyle ?? settings.mapStyle);
  const chooseStyle = (style: MapStyle) => {
    if (status === 'signedIn') updateSettings.mutate({ mapStyle: style });
    else setGuestStyle(style);
  };
  const myMode = (me && (me.travelMode ?? etas[me.memberId]?.mode)) ?? 'car';

  // Ten minutes before sharing ends, everyone is warned once for that end time; an extension moves it.
  const warningKey = trip.data ? `${tripId}|${trip.data.expiresAt}` : null;
  const msLeft = trip.data ? Date.parse(trip.data.expiresAt) - now : Infinity;
  const warningOpen =
    !tripOver &&
    warningKey !== null &&
    dismissedWarning !== warningKey &&
    dialog === null &&
    msLeft > 0 &&
    msLeft <= WARN_BEFORE_MS;
  function dismissWarning() {
    if (!warningKey) return;
    setDismissedWarning(warningKey);
    saveDismissed(warningKey);
  }
  function extended(next: Trip) {
    setDialog(null);
    setToast(`Sharing now ends at ${formatClock(next.expiresAt, settings.timeFormat)}`);
  }

  // Once the trip is over, everyone moves on to how it went. The chat stays open to read.
  useEffect(() => {
    if (tripOver && view !== 'chat') navigate(`/trip/${tripId}/ended`, { replace: true });
  }, [tripOver, view, tripId, navigate]);

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
        onPersonClick={(id) => navigate(`/trip/${tripId}/friend/${id}`)}
        onUserMove={() => setFollowId(null)}
        mapStyle={status === 'signedIn' ? undefined : guestStyle}
        follow={view === 'friend'}
        fitTo={everyone}
        fitKey={fitKey}
        bottomInset={sheetHeight + 20}
        padding={{ top: 88, bottom: sheetHeight + 12 }}
        className={`absolute inset-0 ${socket.connection === 'offline' ? 'grayscale' : ''}`}
      />

      {/* "You made it!" covers the whole screen, so nothing behind it can be reached. */}
      {view !== 'arrived' && (
        <LiveTopBar
          code={code}
          status={statusText}
          live={!tripOver && socket.connection === 'live'}
          back={
            view !== 'map'
              ? { to: `/trip/${tripId}`, label: 'Back to the map' }
              : status === 'signedIn'
                ? { to: '/home', label: 'Back to home' }
                : null
          }
          menuHref={view !== 'menu' && trip.data && !tripOver ? `/trip/${tripId}/menu` : null}
          heading={
            view === 'chat'
              ? {
                  title: 'Trip chat',
                  caption: members.data
                    ? `${members.data.length} ${members.data.length === 1 ? 'friend' : 'friends'}`
                    : '',
                }
              : undefined
          }
        />
      )}

      <div className="absolute inset-x-0 top-[88px] z-10 flex flex-col items-center gap-2 px-3">
        <div aria-live="polite" className="contents">
          {toast && (
            <p className="glass-strong flex items-center gap-2 rounded-pill px-4 py-2 text-[15px] font-bold text-ink">
              <span aria-hidden="true" className="size-2.5 rounded-pill bg-green" />
              {toast}
            </p>
          )}
        </div>
        {!tripOver && view !== 'menu' && me?.pausedAt && (
          <p className="flex items-center gap-2 rounded-pill bg-amber-bg py-1 pr-1 pl-4 text-[15px] font-bold text-amber">
            <MapPinOff aria-hidden="true" className="size-4" />
            Your location is paused
            <button
              type="button"
              onClick={() => setPaused.mutate(false)}
              disabled={setPaused.isPending}
              className="min-h-11 rounded-pill px-3 text-[15px] font-extrabold underline"
            >
              Resume
            </button>
          </p>
        )}
        {setPaused.isError && <Banner tone="error">{describeFailure(setPaused.error)}</Banner>}
        {following && friend && (
          <p className="glass-strong flex items-center gap-2 rounded-pill py-1 pr-1 pl-4 text-[15px] font-bold text-ink">
            <LocateFixed aria-hidden="true" className="size-4 text-blue" />
            Following {friend.displayName}
            <button
              type="button"
              onClick={() => setFollowId(null)}
              className="min-h-11 rounded-pill px-3 text-[15px] font-extrabold text-blue-d"
            >
              Stop
            </button>
          </p>
        )}
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
      </div>

      {!tripOver && view !== 'chat' && view !== 'menu' && view !== 'arrived' && (
        <div
          className="absolute right-3 z-10 flex flex-col gap-2"
          // Above Mapbox's credits button, which sits in the map's bottom-right corner.
          style={{ bottom: sheetHeight + 56 }}
        >
          <LayersControl value={mapStyle} onChange={chooseStyle} />
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
          {chatOn && (
            <Link
              to={`/trip/${tripId}/chat`}
              aria-label={unread > 0 ? `Trip chat, ${unread} unread` : 'Trip chat'}
              className="glass-strong relative mt-3 flex size-14 items-center justify-center rounded-pill text-ink"
            >
              <MessageSquare aria-hidden="true" className="size-6" />
              {unread > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-pill border-2 border-screen bg-red px-1 text-[11px] leading-none font-extrabold text-on-primary"
                >
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          )}
        </div>
      )}

      {view === 'chat' && trip.data ? (
        chatOn ? (
          <TripChat
            ref={sheetRef}
            tripId={tripId}
            members={members.data ?? []}
            typingIds={typingIds}
            onTyping={socket.sendTyping}
            readOnly={tripOver}
            timeFormat={settings.timeFormat}
            now={now}
          />
        ) : (
          <section
            ref={sheetRef}
            aria-labelledby="live-title"
            className="glass-strong absolute inset-x-3 bottom-3 z-10 flex flex-col gap-3 rounded-sheet px-5 pt-5 pb-4"
          >
            <h1 id="live-title" className="text-[20px] leading-[26px] font-extrabold">
              Chat is off for this trip
            </h1>
            <p className="text-sm leading-5 text-muted">The host turned chat off when starting the trip.</p>
            <ButtonLink to={`/trip/${tripId}`} variant="glass">
              Back to the map
            </ButtonLink>
          </section>
        )
      ) : tripOver ? null : view === 'arrived' ? (
        <ArrivedSheet
          ref={sheetRef}
          destination={destinationName ?? 'the destination'}
          summary={arrivedSummary.data ?? null}
          behindMinutes={behindMinutes}
          friends={friends.length}
          unit={settings.distanceUnit}
          finishing={leave.isPending}
          finishError={leave.error}
          onKeepSharing={() => navigate(`/trip/${tripId}`, { replace: true })}
          onFinish={() => (isHost ? setDialog('end') : leave.mutate({ finish: true }))}
        />
      ) : view === 'menu' && trip.data ? (
        <TripMenu
          ref={sheetRef}
          tripId={tripId}
          name={trip.data.name}
          code={trip.data.code}
          left={timeLeft(trip.data.expiresAt, now)}
          isHost={isHost}
          hasSettings={status === 'signedIn'}
          pause={
            me?.sharing
              ? {
                  paused: Boolean(me.pausedAt),
                  pending: setPaused.isPending,
                  onChange: (paused) => setPaused.mutate(paused),
                }
              : undefined
          }
          onExtend={() => setDialog('extend')}
          onEnd={() => setDialog('end')}
          onLeave={() => {
            leave.reset();
            setDialog('leave');
          }}
        />
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
                inviteHref={`/trip/${tripId}/invite`}
                friendHref={(id) => `/trip/${tripId}/friend/${id}`}
              />
            ) : view === 'friend' && members.data ? (
              friend ? (
                <FriendDetails
                  friend={friend}
                  position={friendSpot}
                  eta={etas[friend.memberId]}
                  now={now}
                  unit={settings.distanceUnit}
                  destination={destinationName}
                  following={following}
                  onFollow={() => setFollowId(friend.memberId)}
                  onStopFollowing={() => setFollowId(null)}
                  myMode={myMode}
                  messageHref={chatOn ? `/trip/${tripId}/chat` : undefined}
                />
              ) : (
                <div className="flex flex-col gap-3">
                  <h1 id="live-title" className="text-[20px] leading-[26px] font-extrabold">
                    Not on this trip
                  </h1>
                  <p className="text-sm leading-5 text-muted">They may have left the trip.</p>
                  <ButtonLink to={`/trip/${tripId}`} variant="glass">
                    Back to the map
                  </ButtonLink>
                </div>
              )
            ) : undefined
          }
        >
          {members.isError && <Banner tone="error">{describeFailure(members.error)}</Banner>}
          {view === 'map' && me && !me.sharing && (
            <ShareLocationCard
              onShare={() => startSharing.mutate()}
              pending={startSharing.isPending}
              error={startSharing.error}
            />
          )}
          {view === 'map' && me?.sharing && !me.pausedAt && destination && !me.arrivedAt && (
            <TravelModePicker
              chosen={me.travelMode}
              current={etas[me.memberId]?.mode ?? null}
              onChoose={(mode) => chooseMode.mutate(mode)}
              error={chooseMode.error}
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

      {trip.data && !tripOver && (
        <>
          <ExpiryWarning
            open={warningOpen}
            trip={trip.data}
            isHost={isHost}
            sharing={me?.sharing === true}
            now={now}
            timeFormat={settings.timeFormat}
            onDismiss={dismissWarning}
            onEndNow={() => {
              dismissWarning();
              setDialog('end');
            }}
            onExtended={extended}
          />
          {isHost && (
            <>
              <ExtendDialog
                open={dialog === 'extend'}
                trip={trip.data}
                left={timeLeft(trip.data.expiresAt, now)}
                timeFormat={settings.timeFormat}
                onClose={() => setDialog(null)}
                onExtended={extended}
              />
              <EndTripDialog
                open={dialog === 'end'}
                tripId={tripId}
                friends={friends.length}
                onClose={() => setDialog(null)}
                onEnded={() => {
                  setDialog(null);
                  endTrip();
                }}
              />
            </>
          )}
          {!isHost && (
            <LeaveTripDialog
              open={dialog === 'leave'}
              pending={leave.isPending}
              error={leave.error}
              onLeave={() => leave.mutate({ finish: false })}
              onClose={() => setDialog(null)}
            />
          )}
        </>
      )}
    </main>
  );
}
