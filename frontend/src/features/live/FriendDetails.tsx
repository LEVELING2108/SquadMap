import type { ReactNode } from 'react';
import { LocateFixed, MessageSquare, Navigation } from 'lucide-react';
import { Button, ButtonLink } from '../../components/ui/Button';
import { buttonClasses } from '../../components/ui/buttonStyles';
import { formatDistance } from '../../lib/map/geo';
import type { DistanceUnit } from '../profile/settingsApi';
import { directionsUrl, formatDuration, modeWords, staleLabel } from './liveFormat';
import type { Eta, LiveMember, Position, TravelMode } from './liveTypes';

/** Faster than this counts as moving; GPS drift while standing still stays below it. */
const MOVING_MPS = 1;

type FriendDetailsProps = {
  friend: LiveMember;
  position: Position | undefined;
  eta: Eta | undefined;
  now: number;
  unit: DistanceUnit;
  destination: string | null;
  following: boolean;
  onFollow: () => void;
  onStopFollowing: () => void;
  /** How this person travels, so directions to the friend open in the same mode. */
  myMode: TravelMode;
  /** The trip chat, when chat is on. */
  messageHref?: string;
};

/** One stat, as on the profile: a large value over a small label. */
function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="glass-strong flex min-w-0 flex-1 flex-col rounded-card px-3 py-3">
      <dd className="order-1 m-0 truncate text-[20px] leading-7 font-extrabold">{value}</dd>
      <dt className="order-2 text-[13px] leading-[18px] font-bold text-muted">{label}</dt>
    </div>
  );
}

/** "Moving · updated just now", "Stopped · updated 3 min ago", and the cases with no live spot. */
function statusOf(
  friend: LiveMember,
  position: Position | undefined,
  now: number,
  destination: string | null,
) {
  if (friend.arrivedAt) return destination ? `Arrived at ${destination}` : 'Arrived';
  if (!friend.sharing) return 'Not sharing their location yet';
  if (!position) return 'Waiting for their location';
  if (friend.pausedAt) return `Paused · last seen ${staleLabel(position.ts, now) ?? 'just now'}`;
  // A rough area has no speed, so whether they move can't be told.
  if (position.approx) return `Approximate location · updated ${staleLabel(position.ts, now) ?? 'just now'}`;
  const moving = (position.speed ?? 0) > MOVING_MPS;
  return `${moving ? 'Moving' : 'Stopped'} · updated ${staleLabel(position.ts, now) ?? 'just now'}`;
}

/** Speed in the person's units: "38 km/h" or "24 mph"; a dash when the phone doesn't report it. */
function speedOf(position: Position | undefined, unit: DistanceUnit): string {
  if (position?.speed === undefined) return '—';
  return unit === 'mi'
    ? `${Math.round(position.speed * 2.237)} mph`
    : `${Math.round(position.speed * 3.6)} km/h`;
}

/** D2, one friend: how they are doing, how far they have to go, and ways to reach them. */
export function FriendDetails({
  friend,
  position,
  eta,
  now,
  unit,
  destination,
  following,
  onFollow,
  onStopFollowing,
  myMode,
  messageHref,
}: FriendDetailsProps) {
  const progress = eta ? Math.round(eta.progress * 100) : null;
  // Following and directions need a live spot; there is nothing to follow once they have arrived.
  const canFollow = position !== undefined && friend.sharing && !friend.arrivedAt;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-14 flex-none items-center justify-center rounded-pill text-[22px] font-extrabold text-on-person"
          style={{ backgroundColor: friend.color }}
        >
          {friend.displayName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1
            id="live-title"
            className="truncate text-[24px] leading-[30px] font-extrabold tracking-[-0.3px]"
          >
            {friend.displayName}
          </h1>
          <p className="text-sm leading-5 text-muted">{statusOf(friend, position, now, destination)}</p>
        </div>
        {eta && !friend.arrivedAt && (
          <span className="flex-none rounded-pill bg-amber-bg px-3 py-1 text-sm font-bold text-amber">
            <span className="sr-only">Arrives in </span>
            {formatDuration(eta.durationS)}
          </span>
        )}
      </div>

      {!friend.arrivedAt && (
        <dl aria-label={`${friend.displayName}’s numbers`} className="m-0 flex gap-2">
          <Stat value={eta ? formatDistance(eta.distanceM, unit) : '—'} label="Distance" />
          <Stat
            value={eta ? formatDuration(eta.durationS) : '—'}
            label={eta ? `ETA ${modeWords(eta.mode)}` : 'ETA'}
          />
          <Stat value={speedOf(position, unit)} label="Speed" />
        </dl>
      )}

      {eta && !friend.arrivedAt && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 text-[15px] leading-5 font-bold">
            <span className="truncate text-muted">
              {destination ? `Progress to ${destination}` : 'Progress'}
            </span>
            <span className="flex-none text-muted">{progress}%</span>
          </div>
          <div
            role="progressbar"
            aria-label={`${friend.displayName}’s progress`}
            aria-valuenow={progress ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2.5 overflow-hidden rounded-pill bg-track"
          >
            <div
              className="h-full rounded-pill"
              style={{ width: `${progress}%`, backgroundColor: friend.color }}
            />
          </div>
        </div>
      )}

      {(messageHref || canFollow) && (
        <div className="flex gap-3">
          {messageHref && (
            <ButtonLink to={messageHref} variant="glass" className="flex-1">
              <MessageSquare aria-hidden="true" className="size-5" />
              Message
            </ButtonLink>
          )}
          {canFollow && (
            <Button
              variant="glass"
              aria-pressed={following}
              onClick={following ? onStopFollowing : onFollow}
              // On, it looks selected, like the chosen option in the app's other controls.
              className="flex-1 aria-pressed:bg-tint"
            >
              <LocateFixed aria-hidden="true" className="size-5" />
              {following ? 'Following' : 'Follow'}
            </Button>
          )}
        </div>
      )}

      {canFollow && (
        <div className="flex flex-col gap-3">
          <a
            href={directionsUrl(position!, myMode)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses('primary')}
          >
            <Navigation aria-hidden="true" className="size-5" />
            Directions to {friend.displayName}
          </a>
        </div>
      )}
    </div>
  );
}
