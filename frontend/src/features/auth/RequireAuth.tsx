import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSession } from './session';

/**
 * Shows its children only to a signed-in person. Anyone else is sent to log in, and comes back
 * to the same page afterwards.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useSession((state) => state.status);
  const location = useLocation();

  if (status === 'unknown') {
    return (
      <main aria-busy="true" className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">Signing you in…</p>
      </main>
    );
  }
  if (status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
