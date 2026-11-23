/**
 * Error reports to Sentry, only when the build was given VITE_SENTRY_DSN (production). Without it nothing is
 * loaded or sent. The library is fetched on its own after start-up, so it never slows the first screen.
 *
 * Nothing personal goes with a report: no user details, no request bodies, no console output, and no record
 * of network calls, because map and route addresses can hold coordinates.
 */
export function startErrorReporting(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  void import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        // Sentry 11 collects all of these unless told not to.
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
        },
        tracesSampleRate: 0,
        defaultIntegrations: false,
        integrations: [
          Sentry.globalHandlersIntegration(),
          Sentry.dedupeIntegration(),
          Sentry.linkedErrorsIntegration(),
          // Only where in the app someone was; addresses are trimmed to the path below.
          // No console integration is added, so console output never becomes a breadcrumb.
          Sentry.breadcrumbsIntegration({ dom: false, fetch: false, xhr: false, history: true }),
        ],
        beforeSend: scrubEvent,
        beforeBreadcrumb: (breadcrumb) => ({ ...breadcrumb, data: scrubData(breadcrumb.data) }),
      });
    })
    .catch(() => {
      // Reporting is a nice-to-have; the app works the same without it.
    });
}

type Scrubbable = {
  request?: { url?: string; query_string?: unknown; cookies?: unknown; headers?: unknown; data?: unknown };
  user?: unknown;
  extra?: unknown;
};

/** Keeps the page path only: no query, cookies, headers, body or user. */
export function scrubEvent<T extends Scrubbable>(event: T): T {
  const request = event.request;
  return {
    ...event,
    user: undefined,
    extra: undefined,
    request: request ? { url: pathOnly(request.url) } : undefined,
  };
}

function scrubData(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) return data;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    clean[key] = typeof value === 'string' && /^(https?:\/\/|\/)/.test(value) ? pathOnly(value) : value;
  }
  return clean;
}

/** "https://app.example.com/trip/abc?x=1#y" becomes "/trip/abc". */
export function pathOnly(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    return new URL(url, 'https://squadmap.invalid').pathname;
  } catch {
    return undefined;
  }
}
