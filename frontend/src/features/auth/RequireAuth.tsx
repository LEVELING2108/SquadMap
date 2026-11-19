import type { ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router';
import { useSession } from './session';

type RequireAuthProps = {
  children: ReactNode;
  /** Also lets in a guest, on the page of the one trip their pass is for. */
  allowGuest?: boolean;
};

/**
 * Shows its children only to a signed-in person. Anyone else is sent to log in, and comes back
 * to the same page afterwards. A guest is sent back to their own trip.
 */
export function RequireAuth({ children, allowGuest = false }: RequireAuthProps) {
  const status = useSession((state) => state.status);
  const guest = useSession((state) => state.guest);
  const guestEnded = useSession((state) => state.guestEnded);
  const { tripId } = useParams();
  const location = useLocation();

  if (status === 'unknown') {
    return (
      <main aria-busy="true" className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted">Signing you in…</p>
      </main>
    );
  }
  if (status === 'guest' && guest) {
    if (allowGuest && tripId === guest.tripId) return <>{children}</>;
    return <Navigate to={`/trip/${guest.tripId}`} replace />;
  }
  // A guest whose trip is over has no account to log in to: tell them the trip has ended.
  if (allowGuest && guestEnded) return <Navigate to="/join/expired" replace />;
  if (status !== 'signedIn') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
