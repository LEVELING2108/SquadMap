import { beforeEach, describe, expect, it } from 'vitest';
import { names, staleLabel, timeLeft } from './liveFormat';
import {
  applyLocation,
  clearPositions,
  forgetMember,
  openTrip,
  seedPositions,
  useLiveStore,
} from './liveStore';
import type { LiveMember } from './liveTypes';
import { KEEP_FRESH_MS, metresBetween, shouldSend } from './useLocationSharing';

describe('when a reading is sent', () => {
  const here = { lat: 18.5679, lng: 73.9143 };
  // About 30 m north.
  const there = { lat: 18.5682, lng: 73.9143 };

  it('sends the first reading straight away', () => {
    expect(shouldSend(null, here, 0)).toBe(true);
  });

  it('never sends twice within 2 seconds, even when moving', () => {
    expect(shouldSend({ ...here, at: 0 }, there, 1_999)).toBe(false);
  });

  it('sends after 2 seconds when the person moved', () => {
    expect(metresBetween(here, there)).toBeGreaterThan(30);
    expect(shouldSend({ ...here, at: 0 }, there, 2_000)).toBe(true);
  });

  it('standing still, sends only every 15 seconds to keep the dot fresh', () => {
    const jitter = { lat: 18.56791, lng: 73.91431 };
    expect(shouldSend({ ...here, at: 0 }, jitter, 5_000)).toBe(false);
    expect(shouldSend({ ...here, at: 0 }, jitter, KEEP_FRESH_MS)).toBe(true);
  });
});

describe('live spots', () => {
  const member = (memberId: string, ts: string | null): LiveMember => ({
    memberId,
    displayName: memberId,
    color: '#0F6E56',
    role: 'member',
    you: false,
    sharing: true,
    location: ts ? { lat: 18.5, lng: 73.9, acc: 10, ts } : null,
    arrivedAt: null,
  });

  beforeEach(() => {
    useLiveStore.setState({ tripId: null, positions: {} });
    openTrip('trip-1');
  });

  it('keeps the newer of a live update and a snapshot', () => {
    applyLocation({ memberId: 'aman', lat: 18.6, lng: 73.9, acc: 10, ts: '2026-11-17T10:00:10Z' });
    seedPositions([member('aman', '2026-11-17T10:00:00Z'), member('priya', '2026-11-17T10:00:00Z')]);

    expect(useLiveStore.getState().positions.aman?.lat).toBe(18.6);
    expect(useLiveStore.getState().positions.priya?.lat).toBe(18.5);
  });

  it('ignores a late update older than the spot shown', () => {
    applyLocation({ memberId: 'aman', lat: 18.6, lng: 73.9, acc: 10, ts: '2026-11-17T10:00:10Z' });
    applyLocation({ memberId: 'aman', lat: 18.1, lng: 73.9, acc: 10, ts: '2026-11-17T10:00:05Z' });

    expect(useLiveStore.getState().positions.aman?.lat).toBe(18.6);
  });

  it('forgets someone who left, and everyone when the trip ends', () => {
    seedPositions([member('aman', '2026-11-17T10:00:00Z'), member('priya', '2026-11-17T10:00:00Z')]);

    forgetMember('aman');
    expect(Object.keys(useLiveStore.getState().positions)).toEqual(['priya']);

    clearPositions();
    expect(useLiveStore.getState().positions).toEqual({});
  });

  it('starts empty on another trip', () => {
    seedPositions([member('aman', '2026-11-17T10:00:00Z')]);

    openTrip('trip-2');

    expect(useLiveStore.getState()).toMatchObject({ tripId: 'trip-2', positions: {} });
  });
});

describe('live map words', () => {
  const now = Date.parse('2026-11-17T10:00:00Z');

  it('says how long the trip has left', () => {
    expect(timeLeft('2026-11-17T13:00:00Z', now)).toBe('3 h left');
    expect(timeLeft('2026-11-17T11:30:00Z', now)).toBe('1 h 30 min left');
    expect(timeLeft('2026-11-17T10:45:00Z', now)).toBe('45 min left');
    expect(timeLeft('2026-11-17T09:00:00Z', now)).toBe('0 min left');
  });

  it('marks a spot as old after a minute', () => {
    expect(staleLabel('2026-11-17T09:59:30Z', now)).toBeNull();
    expect(staleLabel('2026-11-17T09:58:00Z', now)).toBe('2 min ago');
    expect(staleLabel('2026-11-17T08:00:00Z', now)).toBe('2 h ago');
  });

  it('lists names the way people say them', () => {
    expect(names(['Aman'])).toBe('Aman');
    expect(names(['Aman', 'Priya'])).toBe('Aman and Priya');
    expect(names(['Aman', 'Priya', 'Rohan'])).toBe('Aman, Priya and Rohan');
    expect(names(['Aman', 'Priya', 'Rohan', 'Sara'])).toBe('Aman, Priya and 2 more');
  });
});
