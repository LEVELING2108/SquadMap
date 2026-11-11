import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useSession } from './session';

/** Pages for signed-out people (log in, sign up). Someone already signed in goes straight home. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const status = useSession((state) => state.status);
  if (status === 'signedIn') return <Navigate to="/home" replace />;
  return <>{children}</>;
}
