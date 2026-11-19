import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import { useSession } from '../auth/session';

export type AlertKind = 'member_joined' | 'member_left' | 'ending_soon' | 'trip_ended';

/** One alert (GET /me/alerts). The app words it; the server keeps only the facts. */
export type Alert = {
  id: string;
  kind: AlertKind;
  tripId: string;
  tripName: string;
  /** The friend it is about (joined, left), as they were named then. */
  actorName: string | null;
  actorColor: string | null;
  createdAt: string;
  read: boolean;
  /** Whether the trip is still running, which decides where tapping leads. */
  tripLive: boolean;
};

type AlertPage = { items: Alert[]; nextBefore: string | null; unread: number };

export const alertKeys = {
  all: ['me', 'alerts'] as const,
  list: ['me', 'alerts', 'list'] as const,
  unread: ['me', 'alerts', 'unread'] as const,
};

/** How often the unread badge is refreshed while the app is open. */
const BADGE_REFRESH_MS = 60_000;

export function useAlerts() {
  return useInfiniteQuery({
    queryKey: alertKeys.list,
    queryFn: ({ pageParam }) =>
      api<AlertPage>(`/me/alerts?limit=30${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
  });
}

/** The number on the Alerts tab. Only accounts have alerts; it refreshes every minute in the open app. */
export function useUnreadAlerts(): number {
  const signedIn = useSession((state) => state.status === 'signedIn');
  const query = useQuery({
    queryKey: alertKeys.unread,
    queryFn: () => api<{ unread: number }>('/me/alerts/unread-count'),
    enabled: signedIn,
    staleTime: BADGE_REFRESH_MS / 2,
    refetchInterval: BADGE_REFRESH_MS,
  });
  return signedIn ? (query.data?.unread ?? 0) : 0;
}

/** Marks alerts read, then refreshes the list and the badge. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string | 'all') =>
      api<void>(
        alertId === 'all' ? '/me/alerts/read-all' : `/me/alerts/${encodeURIComponent(alertId)}/read`,
        {
          method: 'POST',
        },
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: alertKeys.all }),
  });
}

/** Where tapping an alert leads: the running trip (hosts see its invite), or trip history once it's over. */
export function alertLink(alert: Alert): string {
  if (!alert.tripLive || alert.kind === 'trip_ended') return '/me/history';
  return `/trip/${encodeURIComponent(alert.tripId)}/invite`;
}

/** The alert's headline, in the app's words. */
export function alertTitle(alert: Alert): string {
  switch (alert.kind) {
    case 'member_joined':
      return `${alert.actorName ?? 'Someone'} joined your trip`;
    case 'member_left':
      return `${alert.actorName ?? 'Someone'} left your trip`;
    case 'ending_soon':
      return 'Sharing ends soon';
    case 'trip_ended':
      return `${alert.tripName} ended`;
  }
}

/** Whether the moment falls on the same calendar day as now, for the TODAY group. */
export function isToday(iso: string, now = new Date()): boolean {
  const date = new Date(iso);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
