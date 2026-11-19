import { useSearchParams } from 'react-router';
import { Clock } from 'lucide-react';
import { ButtonLink } from '../../components/ui/Button';
import { AuthScreen } from '../auth/AuthScreen';
import { useSession } from '../auth/session';
import { normalizeCode } from './joinApi';
import { timeAgo } from './timeAgo';

/** A rubber stamp, slightly turned, as on a used ticket. */
function ExpiredStamp() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 170 170"
      className="absolute top-[170px] left-1/2 size-[164px] -translate-x-1/2 text-red"
    >
      <defs>
        <path id="stamp-top" d="M 30 85 A 55 55 0 0 1 140 85" />
        <path id="stamp-bottom" d="M 36 85 A 49 49 0 0 0 134 85" />
      </defs>
      <circle cx="85" cy="85" r="82" className="fill-screen/85" />
      <circle cx="85" cy="85" r="81" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="85" cy="85" r="75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <g transform="rotate(-14 85 85)" fill="currentColor" fontFamily="var(--font-display)" fontWeight="800">
        <text fontSize="12" letterSpacing="3" textAnchor="middle">
          <textPath href="#stamp-top" startOffset="50%">
            SQUADMAP
          </textPath>
        </text>
        <text x="85" y="96" fontSize="30" letterSpacing="1.5" textAnchor="middle">
          EXPIRED
        </text>
        <text fontSize="11" letterSpacing="3" textAnchor="middle" dominantBaseline="hanging">
          <textPath href="#stamp-bottom" startOffset="50%">
            TRIP LINK
          </textPath>
        </text>
      </g>
    </svg>
  );
}

/** Where a trip link lands once the trip is over. */
export function ExpiredPage() {
  const [params] = useSearchParams();
  const code = normalizeCode(params.get('code') ?? '');
  const ended = timeAgo(params.get('ended') ?? '');
  const signedIn = useSession((state) => state.status) === 'signedIn';

  return (
    <AuthScreen titleId="expired-title" topSpace={430} decoration={<ExpiredStamp />}>
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
