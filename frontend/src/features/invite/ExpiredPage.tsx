import { useSearchParams } from 'react-router';
import { Clock } from 'lucide-react';
import { ButtonLink } from '../../components/ui/Button';
import { AuthScreen } from '../auth/AuthScreen';
import { useSession } from '../auth/session';
import { normalizeCode } from './joinApi';
import { Stamp } from '../../components/ui/Stamp';
import { timeAgo } from './timeAgo';

/** Where a trip link lands once the trip is over. */
export function ExpiredPage() {
  const [params] = useSearchParams();
  const code = normalizeCode(params.get('code') ?? '');
  const ended = timeAgo(params.get('ended') ?? '');
  const signedIn = useSession((state) => state.status) === 'signedIn';

  return (
    <AuthScreen
      titleId="expired-title"
      topSpace={430}
      decoration={
        <Stamp
          word="EXPIRED"
          bottom="TRIP LINK"
          className="absolute top-[170px] left-1/2 size-[164px] -translate-x-1/2"
        />
      }
    >
      <div className="motion-rise">
        <h1 id="expired-title" className="text-[28px] leading-[34px] font-extrabold tracking-[-0.5px]">
          This trip has ended
        </h1>
        <p className="mt-1 text-sm leading-5 text-muted">
          Trip links stop working after the sharing time runs out. Ask the host to start a new trip.
        </p>
      </div>
      {code && (
        <p className="flex items-center gap-3 rounded-card bg-amber-bg px-4 py-3.5 text-sm leading-5 font-semibold text-amber">
          <Clock aria-hidden="true" className="size-6 flex-none" />
          <span>
            Code <span className="font-mono tracking-[1px]">{code}</span> ended{ended ? ` ${ended}` : ''}
          </span>
        </p>
      )}
      <ButtonLink to={signedIn ? '/home' : '/signup'}>Start my own trip</ButtonLink>
      <ButtonLink to="/join" variant="glass">
        Enter a different code
      </ButtonLink>
      <ButtonLink to="/home" variant="text">
        Go to home
      </ButtonLink>
    </AuthScreen>
  );
}
