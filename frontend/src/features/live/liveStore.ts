import { create } from 'zustand';
import type { Eta, LiveMember, MemberLocation, Position } from './liveTypes';

type LiveState = {
  /** The trip these belong to; switching trips starts empty. */
  tripId: string | null;
  /** Each member's newest spot, by member id. Live data only: who is on the trip comes from the server. */
  positions: Record<string, Position>;
  /** Each member's newest ETA, by member id. */
  etas: Record<string, Eta>;
};

export const useLiveStore = create<LiveState>(() => ({ tripId: null, positions: {}, etas: {} }));

const isNewer = (next: { ts: string }, current: { ts: string } | undefined) =>
  !current || Date.parse(next.ts) > Date.parse(current.ts);

const isNewerEta = (next: Eta, current: Eta | undefined) =>
  !current || Date.parse(next.computedAt) >= Date.parse(current.computedAt);

/** Starts the live map for a trip, forgetting any other trip's spots and ETAs. */
export function openTrip(tripId: string): void {
  if (useLiveStore.getState().tripId !== tripId) useLiveStore.setState({ tripId, positions: {}, etas: {} });
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

/** Adds ETAs from a snapshot, keeping any newer one that already arrived live. */
export function seedEtas(etas: Eta[]): void {
  useLiveStore.setState((state) => {
    const next = { ...state.etas };
    for (const eta of etas) {
      if (isNewerEta(eta, next[eta.memberId])) next[eta.memberId] = eta;
    }
    return { etas: next };
  });
}

export function applyEta(eta: Eta): void {
  useLiveStore.setState((state) =>
    isNewerEta(eta, state.etas[eta.memberId]) ? { etas: { ...state.etas, [eta.memberId]: eta } } : state,
  );
}

/** Someone arrived: their ETA is over. */
export function forgetEta(memberId: string): void {
  useLiveStore.setState((state) => {
    const etas = { ...state.etas };
    delete etas[memberId];
    return { etas };
  });
}

export function forgetMember(memberId: string): void {
  useLiveStore.setState((state) => {
    const positions = { ...state.positions };
    delete positions[memberId];
    const etas = { ...state.etas };
    delete etas[memberId];
    return { positions, etas };
  });
}

/** The trip ended: no spot or ETA may be shown any more. */
export function clearPositions(): void {
  useLiveStore.setState({ positions: {}, etas: {} });
}
