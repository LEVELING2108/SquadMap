import { create } from 'zustand';
import type { DraftDestination } from './types';

export const SHARE_HOURS = [1, 2, 4, 8] as const;
export type ShareHours = (typeof SHARE_HOURS)[number];

type TripDraft = {
  /** undefined until the host picks a place or skips; null means "no destination". */
  destination: DraftDestination | null | undefined;
  /** The name as typed; null while the suggested name is still in use. */
  name: string | null;
  /** null until the host picks one: the account's default sharing time applies until then. */
  shareHours: ShareHours | null;
  /** null until the host flips it: the account's chat default applies until then. */
  chatEnabled: boolean | null;
  /** One key per draft, so a double tap or a retry can't start two trips. */
  idempotencyKey: string;
};

function fresh(): TripDraft {
  return {
    destination: undefined,
    name: null,
    shareHours: null,
    chatEnabled: null,
    idempotencyKey: crypto.randomUUID(),
  };
}

/**
 * The trip being set up, kept while the host moves between the destination, map and new trip
 * screens. It lives in memory only and is cleared once the trip is created.
 */
export const useTripDraft = create<TripDraft>(fresh);

export function setDraftDestination(destination: DraftDestination | null): void {
  useTripDraft.setState({ destination });
}

export function resetTripDraft(): void {
  useTripDraft.setState(fresh());
}

/** "Sunday at Phoenix Marketcity", or "Sunday trip" without a destination. */
export function suggestedName(destination: DraftDestination | null | undefined, now = new Date()): string {
  const day = now.toLocaleDateString('en', { weekday: 'long' });
  if (!destination) return `${day} trip`;
  const place = destination.name.split(',')[0]!.trim();
  return `${day} at ${place}`.slice(0, 60);
}
