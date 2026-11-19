import { describe, expect, it } from 'vitest';
import { groupLabel, startsGroup, typingWords } from './chatFormat';
import type { ChatMessage } from './chatTypes';

const at = (iso: string): ChatMessage => ({
  id: iso,
  memberId: 'm',
  displayName: 'Priya',
  color: null,
  text: 'Hi',
  sentAt: iso,
});

describe('chat time labels', () => {
  it('starts a group with the first message, after 15 quiet minutes, and on a new day', () => {
    expect(startsGroup(undefined, at('2026-11-18T10:00:00'))).toBe(true);
    expect(startsGroup(at('2026-11-18T10:00:00'), at('2026-11-18T10:15:00'))).toBe(false);
    expect(startsGroup(at('2026-11-18T10:00:00'), at('2026-11-18T10:15:01'))).toBe(true);
    expect(startsGroup(at('2026-11-18T23:58:00'), at('2026-11-19T00:01:00'))).toBe(true);
  });

  it('says today, yesterday, or the date', () => {
    const now = new Date('2026-11-18T19:00:00').getTime();

    expect(groupLabel('2026-11-18T17:42:00', now, '12h')).toBe('Today 5:42 PM');
    expect(groupLabel('2026-11-17T09:10:00', now, '24h')).toBe('Yesterday 09:10');
    expect(groupLabel('2026-11-12T17:42:00', now, '12h')).toBe('Thu 12 Nov, 5:42 PM');
  });
});

describe('who is typing', () => {
  it('names one or two people and counts more', () => {
    expect(typingWords([])).toBe('');
    expect(typingWords(['Aman'])).toBe('Aman is typing');
    expect(typingWords(['Aman', 'Rohan'])).toBe('Aman and Rohan are typing');
    expect(typingWords(['Aman', 'Rohan', 'Priya'])).toBe('3 people are typing');
  });
});
