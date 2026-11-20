/**
 * How alerts are worded and where they lead. Kept apart from the API code so the service worker can use
 * the same words for push notifications without loading the app.
 */

export type AlertKind = 'member_joined' | 'member_left' | 'ending_soon' | 'trip_ended';

/** The facts an alert carries, in the inbox and in a push message alike. */
export type AlertFacts = {
  kind: AlertKind;
  tripId: string;
  tripName: string;
  actorName: string | null;
};

/** Where tapping an alert leads: the running trip (hosts see its invite), or trip history once it's over. */
export function alertLink(alert: AlertFacts & { tripLive: boolean }): string {
  if (!alert.tripLive || alert.kind === 'trip_ended') return '/me/history';
  return `/trip/${encodeURIComponent(alert.tripId)}/invite`;
}

/** The alert's headline, in the app's words. */
export function alertTitle(alert: AlertFacts): string {
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

/** The line under the headline in a push notification. */
export function pushBody(alert: AlertFacts): string {
  switch (alert.kind) {
    case 'ending_soon':
      return `${alert.tripName} · Extend or end the trip`;
    case 'trip_ended':
      return 'Location sharing has stopped';
    default:
      return alert.tripName;
  }
}

/** What a push message from the server holds (see PushService on the server). */
export type PushMessage = AlertFacts & { alertId: string };

const KINDS: readonly AlertKind[] = ['member_joined', 'member_left', 'ending_soon', 'trip_ended'];

/**
 * The notification for a push message, or null for one the app doesn't understand (say, sent by a newer
 * server). A message is sent at the moment it happens, so the trip is taken to be still running.
 */
export function pushNotification(
  data: unknown,
): { title: string; body: string; url: string; tag: string } | null {
  if (typeof data !== 'object' || data === null) return null;
  const message = data as Partial<Record<keyof PushMessage, unknown>>;
  if (
    !KINDS.includes(message.kind as AlertKind) ||
    typeof message.tripId !== 'string' ||
    typeof message.tripName !== 'string' ||
    typeof message.alertId !== 'string'
  ) {
    return null;
  }
  const facts: AlertFacts = {
    kind: message.kind as AlertKind,
    tripId: message.tripId,
    tripName: message.tripName,
    actorName: typeof message.actorName === 'string' ? message.actorName : null,
  };
  return {
    title: alertTitle(facts),
    body: pushBody(facts),
    url: alertLink({ ...facts, tripLive: true }),
    // A newer warning about the same trip replaces the older one; each join or leave stands alone.
    tag:
      facts.kind === 'ending_soon' || facts.kind === 'trip_ended'
        ? `${facts.kind}:${facts.tripId}`
        : message.alertId,
  };
}
