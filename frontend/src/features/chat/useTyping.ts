import { useCallback, useEffect, useState } from 'react';

/** The dots stay up this long after someone's last "typing" signal; their app sends one every 2 seconds. */
export const TYPING_SHOWN_MS = 5_000;

/**
 * Who is typing right now. `noteTyping` is called for each signal, `stopTyping` when their message
 * arrives; each person drops off on their own after {@link TYPING_SHOWN_MS}.
 */
export function useTyping() {
  const [until, setUntil] = useState<Record<string, number>>({});

  const noteTyping = useCallback((memberId: string) => {
    setUntil((current) => ({ ...current, [memberId]: Date.now() + TYPING_SHOWN_MS }));
  }, []);

  const stopTyping = useCallback((memberId: string) => {
    setUntil((current) => {
      if (!(memberId in current)) return current;
      const rest = { ...current };
      delete rest[memberId];
      return rest;
    });
  }, []);

  // Wakes up when the next person's dots are due to go.
  useEffect(() => {
    const times = Object.values(until);
    if (times.length === 0) return;
    const timer = setTimeout(
      () => {
        const now = Date.now();
        setUntil((current) => Object.fromEntries(Object.entries(current).filter(([, time]) => time > now)));
      },
      Math.max(0, Math.min(...times) - Date.now()) + 50,
    );
    return () => clearTimeout(timer);
  }, [until]);

  return { typingIds: Object.keys(until), noteTyping, stopTyping };
}
