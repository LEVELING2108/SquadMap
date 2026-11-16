import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import { useResolvedTheme } from '../../lib/useResolvedTheme';
import { useSession } from '../auth/session';

export type DistanceUnit = 'km' | 'mi';

/** The account's preferences (GET /me/settings). */
export type Settings = {
  /** Maps are always dark; otherwise they follow the app's theme. */
  darkMap: boolean;
  distanceUnit: DistanceUnit;
  defaultShareHours: 1 | 2 | 4 | 8;
};

/** What applies before the account's settings arrive, and for anyone without an account. */
export const DEFAULT_SETTINGS: Settings = { darkMap: false, distanceUnit: 'km', defaultShareHours: 4 };

export const settingsKey = ['me', 'settings'] as const;
export const statsKey = ['me', 'stats'] as const;

/** The signed-in account's settings. Guests and visitors get the defaults without a request. */
export function useSettings() {
  const signedIn = useSession((state) => state.status === 'signedIn');
  const query = useQuery({
    queryKey: settingsKey,
    queryFn: () => api<Settings>('/me/settings'),
    enabled: signedIn,
    staleTime: 5 * 60_000,
  });
  return { ...query, settings: query.data ?? DEFAULT_SETTINGS };
}

const SAVE_SETTINGS = ['me', 'settings', 'save'] as const;

/**
 * Changes settings at once on screen, and puts them back if the server refuses. Changes are sent one
 * after another, in the order they were made, so quick taps can't arrive out of order.
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const othersWaiting = () => queryClient.isMutating({ mutationKey: SAVE_SETTINGS }) > 1;
  return useMutation({
    mutationKey: SAVE_SETTINGS,
    scope: { id: 'settings' },
    mutationFn: (changes: Partial<Settings>) =>
      api<Settings>('/me/settings', { method: 'PATCH', body: changes }),
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: settingsKey });
      const before = queryClient.getQueryData<Settings>(settingsKey);
      queryClient.setQueryData<Settings>(settingsKey, { ...(before ?? DEFAULT_SETTINGS), ...changes });
      return { before };
    },
    onError: (_error, changes, context) => {
      // Undo just this change; the server's copy is then fetched to be sure.
      const current = queryClient.getQueryData<Settings>(settingsKey);
      if (current && context?.before) {
        const undone = { ...current };
        for (const key of Object.keys(changes) as Array<keyof Settings>) {
          Object.assign(undone, { [key]: context.before[key] });
        }
        queryClient.setQueryData(settingsKey, undone);
      }
      void queryClient.invalidateQueries({ queryKey: settingsKey });
    },
    onSuccess: (saved) => {
      // While more changes wait to be sent, the screen already shows them; only the last answer is the
      // full picture.
      if (!othersWaiting()) queryClient.setQueryData(settingsKey, saved);
    },
  });
}

/**
 * The look maps should use: always dark with the Dark map setting, otherwise the app's theme. Null while
 * a signed-in account's settings are still loading, so a map isn't drawn in one style and then again in
 * the other.
 */
export function useMapTheme(): 'light' | 'dark' | null {
  const theme = useResolvedTheme();
  const { settings, isLoading } = useSettings();
  if (isLoading) return null;
  return settings.darkMap ? 'dark' : theme;
}

export type Stats = { trips: number; friends: number };

export function useStats() {
  return useQuery({ queryKey: statsKey, queryFn: () => api<Stats>('/me/stats') });
}
