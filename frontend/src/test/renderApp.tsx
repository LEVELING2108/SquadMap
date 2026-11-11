import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router';
import { AppRoutes } from '../AppRoutes';

/** Shows the current address, so tests can check where navigation ended up. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.hash}</div>;
}

export function renderApp(entry: string | { pathname: string; hash?: string; state?: unknown }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
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
