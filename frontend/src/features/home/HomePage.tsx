import { useNavigate } from 'react-router';
import { Compass } from 'lucide-react';
import { Button, ButtonLink } from '../../components/ui/Button';
import { signOut, useSession } from '../auth/session';

/**
 * Temporary home. The real one (map, trips, bottom navigation) replaces it; until then it
 * confirms who is signed in and offers a way out, or a way in for people exploring.
 */
export function HomePage() {
  const navigate = useNavigate();
  const status = useSession((state) => state.status);
  const user = useSession((state) => state.user);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col justify-center gap-4 bg-sand px-5 py-8">
      <p className="flex items-center gap-2 font-extrabold">
        <Compass aria-hidden="true" className="size-6 text-blue" />
        SquadMap
      </p>

      {status === 'signedIn' && user ? (
        <section aria-labelledby="home-title" className="glass-strong flex flex-col gap-4 rounded-card p-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-12 flex-none items-center justify-center rounded-pill text-lg font-extrabold text-on-person"
              style={{ backgroundColor: user.color }}
            >
              {user.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1 id="home-title" className="truncate text-[22px] leading-7 font-extrabold">
                Hi, {user.name}
              </h1>
              <p className="truncate text-sm leading-5 text-muted">{user.email}</p>
            </div>
          </div>
          <p className="text-sm leading-5 text-muted">
            You are signed in. Trips, the live map and your friends will appear here soon.
          </p>
          <Button
            variant="glass"
            onClick={async () => {
              await signOut();
              navigate('/', { replace: true });
            }}
          >
            Log out
          </Button>
        </section>
      ) : (
        <section aria-labelledby="home-title" className="glass-strong flex flex-col gap-4 rounded-card p-5">
          <h1 id="home-title" className="text-[22px] leading-7 font-extrabold">
            {status === 'unknown' ? 'Loading…' : 'You are exploring'}
          </h1>
          <p className="text-sm leading-5 text-muted">
            Create an account to start a trip and invite friends, or log in if you already have one.
          </p>
          <ButtonLink to="/signup">Create account</ButtonLink>
          <ButtonLink to="/login" variant="glass">
            Log in
          </ButtonLink>
        </section>
      )}
    </main>
  );
}
