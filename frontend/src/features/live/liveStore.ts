import { create } from 'zustand';
import type { LiveMember, MemberLocation, Position } from './liveTypes';

type LiveState = {
  /** The trip these spots belong to; switching trips starts empty. */
  tripId: string | null;
  /** Each member's newest spot, by member id. Live data only: who is on the trip comes from the server. */
  positions: Record<string, Position>;
};

export const useLiveStore = create<LiveState>(() => ({ tripId: null, positions: {} }));

const isNewer = (next: Position, current: Position | undefined) =>
  !current || Date.parse(next.ts) > Date.parse(current.ts);

/** Starts the live map for a trip, forgetting any other trip's spots. */
export function openTrip(tripId: string): void {
  if (useLiveStore.getState().tripId !== tripId) useLiveStore.setState({ tripId, positions: {} });
}

/** Adds the spots from a snapshot, keeping any newer one that already arrived live. */
export function seedPositions(members: LiveMember[]): void {
  useLiveStore.setState((state) => {
    const positions = { ...state.positions };
    for (const member of members) {
      if (member.location && isNewer(member.location, positions[member.memberId])) {
        positions[member.memberId] = member.location;
      }
    }
    return { positions };
  });
}

/** A member moved. Late messages (older than what is shown) are ignored. */
export function applyLocation({ memberId, ...position }: MemberLocation): void {
  useLiveStore.setState((state) =>
    isNewer(position, state.positions[memberId])
      ? { positions: { ...state.positions, [memberId]: position } }
      : state,
  );
}

export function forgetMember(memberId: string): void {
  useLiveStore.setState((state) => {
    const rest = { ...state.positions };
    delete rest[memberId];
    return { positions: rest };
  });
}

/** The trip ended: no spot may be shown any more. */
export function clearPositions(): void {
  useLiveStore.setState({ positions: {} });
}
