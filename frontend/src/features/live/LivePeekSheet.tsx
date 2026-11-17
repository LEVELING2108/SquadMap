import type { ReactNode } from 'react';
import { forwardRef } from 'react';
import { Link } from 'react-router';
import { ChevronUp } from 'lucide-react';
import type { Eta, LiveMember, Position } from './liveTypes';
import { formatDuration, modeWords, names, staleLabel } from './liveFormat';

type LivePeekSheetProps = {
  friends: LiveMember[];
  positions: Record<string, Position>;
  etas: Record<string, Eta>;
  now: number;
  code: string;
  /** Where "Who's on the way" opens. */
  listHref: string;
  /** Short destination name, or null. */
  destination: string | null;
  /** Shown in place of the short summary, such as the full "Who's on the way" list. */
  expanded?: ReactNode;
  /** Prompts and messages shown above the summary, such as "Share your location". */
  children?: ReactNode;
};

/** How one friend is doing, in words: for the screen reader list, since the map itself is a picture. */
function describe(
  friend: LiveMember,
  position: Position | undefined,
  eta: Eta | undefined,
  now: number,
): string {
  if (friend.arrivedAt) return `${friend.displayName}, arrived`;
  if (!friend.sharing) return `${friend.displayName}, not sharing their location yet`;
  if (!position) return `${friend.displayName}, waiting for their location`;
  const stale = staleLabel(position.ts, now);
  const where = stale ? `last seen ${stale}` : 'live on the map';
  return eta
    ? `${friend.displayName}, ${where}, ${formatDuration(eta.durationS)} away ${modeWords(eta.mode)}`
    : `${friend.displayName}, ${where}`;
}

/** The sheet at the bottom of the live map: who is on the trip, in short, or the full list. */
export const LivePeekSheet = forwardRef<HTMLElement, LivePeekSheetProps>(function LivePeekSheet(
  { friends, positions, etas, now, code, listHref, destination, expanded, children },
  ref,
) {
  const onTheWay = friends.filter((friend) => !friend.arrivedAt);
  const notSharing = onTheWay.filter((friend) => !friend.sharing).map((friend) => friend.displayName);
  const next = onTheWay
    .flatMap((friend) => (etas[friend.memberId] ? [{ friend, eta: etas[friend.memberId]! }] : []))
    .sort((a, b) => a.eta.durationS - b.eta.durationS)[0];
  const title =
    friends.length === 0
      ? 'Waiting for friends'
      : onTheWay.length === 0
        ? 'Everyone has arrived'
        : `${onTheWay.length} ${onTheWay.length === 1 ? 'friend' : 'friends'} on the way`;
  const subtitle =
    friends.length === 0
      ? `Share the code ${code} so they can join.`
      : next
        ? `Next: ${next.friend.displayName} in ${formatDuration(next.eta.durationS)} · ${modeWords(next.eta.mode)}`
        : notSharing.length > 0
          ? `${names(notSharing)} ${notSharing.length === 1 ? 'hasn’t' : 'haven’t'} shared yet`
          : onTheWay.length === 0
            ? destination
              ? `All at ${destination}`
              : 'Everyone is there'
            : 'Everyone is sharing their location';

  return (
    <section
      ref={ref}
      aria-labelledby="live-title"
      className="glass-strong absolute inset-x-3 bottom-3 z-10 flex max-h-[60dvh] flex-col gap-3 overflow-y-auto rounded-sheet px-5 pt-3 pb-4"
    >
      <div aria-hidden="true" className="mx-auto h-1 w-10 flex-none rounded-[2px] bg-handle" />
      {children}
      {expanded ?? (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 id="live-title" className="text-[20px] leading-[26px] font-extrabold">
              {title}
            </h1>
            <p aria-live="polite" className="text-sm leading-5 text-muted">
              {subtitle}
            </p>
          </div>
          {friends.length > 0 && (
            <div aria-hidden="true" className="flex flex-none -space-x-2.5">
              {friends.slice(0, 3).map((friend) => (
                <span
                  key={friend.memberId}
                  className="flex size-10 items-center justify-center rounded-pill border-2 border-screen text-base font-extrabold text-on-person"
                  style={{ backgroundColor: friend.color }}
                >
                  {friend.displayName.charAt(0).toUpperCase()}
                </span>
              ))}
            </div>
          )}
          {friends.length > 0 && (
            <Link
              to={listHref}
              aria-label="Who’s on the way"
              className="flex size-11 flex-none items-center justify-center rounded-pill text-ink"
            >
              <ChevronUp aria-hidden="true" className="size-6" />
            </Link>
          )}
        </div>
      )}
      {friends.length > 0 && !expanded && (
        <ul aria-label="Friends on this trip" className="sr-only">
          {friends.map((friend) => (
            <li key={friend.memberId}>
              {describe(friend, positions[friend.memberId], etas[friend.memberId], now)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});
