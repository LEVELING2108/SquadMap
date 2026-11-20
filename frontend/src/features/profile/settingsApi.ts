import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import { useResolvedTheme } from '../../lib/useResolvedTheme';
import { useSession } from '../auth/session';

export type DistanceUnit = 'km' | 'mi';
export type MapStyle = 'streets' | 'outdoors' | 'satellite';
export type TimeFormat = '12h' | '24h';

/** The account's preferences (GET /me/settings). */
export type Settings = {
  /** Maps are always dark; otherwise they follow the app's theme. */
  darkMap: boolean;
  distanceUnit: DistanceUnit;
  defaultShareHours: 1 | 2 | 4 | 8;
  mapStyle: MapStyle;
  /** Whether "Friends can chat" starts on for a new trip. */
  chatDefault: boolean;
  /** Turns off the app's moving effects, even where the device allows them. */
  reduceMotion: boolean;
  timeFormat: TimeFormat;
  /** Which alerts are also sent as push notifications, on devices that turned them on. */
  pushJoined: boolean;
  pushLeft: boolean;
  pushEndingSoon: boolean;
  pushTripEnded: boolean;
  /** Share the exact spot; off sends only a rough area of about 220 m. */
  preciseLocation: boolean;
  /** Keep finished trips in the history; off removes them a day after they end. */
  keepHistory: boolean;
};

/** What applies before the account's settings arrive, and for anyone without an account. */
export const DEFAULT_SETTINGS: Settings = {
  darkMap: false,
  distanceUnit: 'km',
  defaultShareHours: 4,
  mapStyle: 'streets',
  chatDefault: true,
  reduceMotion: false,
  timeFormat: '12h',
  pushJoined: true,
  pushLeft: false,
  pushEndingSoon: true,
  pushTripEnded: true,
  preciseLocation: true,
  keepHistory: true,
};

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
 * The Mapbox style every map uses, as "owner/style". Streets follows the app's theme, or is always dark
 * with the Dark map setting; Outdoors and Satellite look the same day and night. Null while a signed-in
 * account's settings are still loading, so a map isn't drawn in one style and then again in another.
 *
 * @param override a style chosen on this screen only (a guest's choice from the Layers button)
 */
export function useMapStyle(override?: MapStyle): string | null {
  const theme = useResolvedTheme();
  const { settings, isLoading } = useSettings();
  if (isLoading) return null;
  const mapStyle = override ?? settings.mapStyle;
  if (mapStyle === 'outdoors') return 'mapbox/outdoors-v12';
  if (mapStyle === 'satellite') return 'mapbox/satellite-streets-v12';
  return settings.darkMap || theme === 'dark' ? 'mapbox/dark-v11' : 'mapbox/streets-v12';
}

export type Stats = { trips: number; friends: number };

export function useStats() {
  return useQuery({ queryKey: statsKey, queryFn: () => api<Stats>('/me/stats') });
}
