import { render } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router';
import { AppRoutes } from '../AppRoutes';
import { alertKeys } from '../features/alerts/alertsApi';
import { AccountPreferences } from '../features/profile/AccountPreferences';
import { DEFAULT_SETTINGS, settingsKey, type Settings } from '../features/profile/settingsApi';
import type { Trip } from '../features/trip/types';
import { createQueryClient } from '../lib/api/queryClient';

/** Shows the current address, so tests can check where navigation ended up. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.hash}</div>;
}

type RenderOptions = {
  /**
   * The account's settings, as if already loaded, so screens don't ask for them. Defaults to the
   * defaults; null leaves them to be fetched, for tests of the settings themselves.
   */
  settings?: Settings | null;
  /** The unread count on the Alerts tab, as if already loaded; null leaves it to be fetched. */
  unreadAlerts?: number | null;
};

export function renderApp(
  entry: string | { pathname: string; hash?: string; state?: unknown },
  { settings = DEFAULT_SETTINGS, unreadAlerts = 0 }: RenderOptions = {},
) {
  const queryClient = createQueryClient();
  if (settings) queryClient.setQueryData(settingsKey, settings);
  // The unread badge is on every signed-in screen; tests of alerts set their own.
  if (unreadAlerts !== null) queryClient.setQueryData(alertKeys.unread, { unread: unreadAlerts });
  return render(
    <QueryClientProvider client={queryClient}>
      <AccountPreferences />
      <MemoryRouter initialEntries={[entry]}>
        <AppRoutes />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export function jsonResponse(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers:
      body === undefined
        ? headers
        : { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json', ...headers },
  });
}

export const testUser = {
  id: 'u1',
  name: 'Priya',
  email: 'priya@example.com',
  color: '#0F6E56',
  createdAt: '2026-11-11T00:00:00Z',
};

/** A trip as GET /trips/:id returns it; override what a test cares about. */
export const sampleTrip: Trip = {
  id: 'trip-1',
  name: 'Saturday at Phoenix',
  code: 'K7QX2P9T',
  inviteUrl: 'http://localhost:5480/join/K7QX2P9T',
  destination: { name: 'Phoenix Marketcity, Viman Nagar', lat: 18.5622, lng: 73.9167 },
  chatEnabled: true,
  startsAt: '2026-11-12T10:00:00Z',
  expiresAt: '2026-11-12T14:00:00Z',
  status: 'active',
  role: 'host',
  memberCount: 1,
};
