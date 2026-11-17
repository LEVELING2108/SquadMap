import type { ReactNode } from 'react';
import { forwardRef } from 'react';
import type { LiveMember, Position } from './liveTypes';
import { names, staleLabel } from './liveFormat';

type LivePeekSheetProps = {
  friends: LiveMember[];
  positions: Record<string, Position>;
  now: number;
  code: string;
  /** Prompts and messages shown above the summary, such as "Share your location". */
  children?: ReactNode;
};

/** How one friend is doing, in words: for the screen reader list, since the map itself is a picture. */
function describe(friend: LiveMember, position: Position | undefined, now: number): string {
  if (!friend.sharing) return `${friend.displayName}, not sharing their location yet`;
  if (!position) return `${friend.displayName}, waiting for their location`;
  const stale = staleLabel(position.ts, now);
  return stale ? `${friend.displayName}, last seen ${stale}` : `${friend.displayName}, live on the map`;
}

/** The sheet at the bottom of the live map: who is on the trip, in short. */
export const LivePeekSheet = forwardRef<HTMLElement, LivePeekSheetProps>(function LivePeekSheet(
  { friends, positions, now, code, children },
  ref,
) {
  const notSharing = friends.filter((friend) => !friend.sharing).map((friend) => friend.displayName);
  const title =
    friends.length === 0
      ? 'Waiting for friends'
      : `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'} on the way`;
  const subtitle =
    friends.length === 0
      ? `Share the code ${code} so they can join.`
      : notSharing.length > 0
        ? `${names(notSharing)} ${notSharing.length === 1 ? 'hasn’t' : 'haven’t'} shared yet`
        : 'Everyone is sharing their location';

  return (
    <section
      ref={ref}
      aria-labelledby="live-title"
      className="glass-strong absolute inset-x-3 bottom-3 z-10 flex max-h-[55dvh] flex-col gap-3 overflow-y-auto rounded-sheet px-5 pt-3 pb-4"
    >
      <div aria-hidden="true" className="mx-auto h-1 w-10 flex-none rounded-[2px] bg-handle" />
      {children}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 id="live-title" className="text-[20px] leading-[26px] font-extrabold">
            {title}
          </h1>
          <p className="text-sm leading-5 text-muted">{subtitle}</p>
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
      </div>
      {friends.length > 0 && (
        <ul aria-label="Friends on this trip" className="sr-only">
          {friends.map((friend) => (
            <li key={friend.memberId}>{describe(friend, positions[friend.memberId], now)}</li>
          ))}
        </ul>
      )}
    </section>
  );
});
