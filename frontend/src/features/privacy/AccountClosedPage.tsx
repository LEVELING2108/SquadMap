import { useSearchParams } from 'react-router';
import { ButtonLink } from '../../components/ui/Button';
import { AuthScreen } from '../auth/AuthScreen';
import { longDate } from './privacyApi';

/** Where someone lands after closing their account: what happens next, and how to change their mind. */
export function AccountClosedPage() {
  const [params] = useSearchParams();
  const day = longDate(params.get('removeAt') ?? '');

  return (
    <AuthScreen titleId="closed-title" topSpace={360} backdrop="sky">
      <div className="motion-rise">
        <h1 id="closed-title" className="text-[28px] leading-[34px] font-heading tracking-[-0.5px]">
          Your account is closed
        </h1>
        <p className="mt-1 text-sm leading-5 text-muted">
          {day
            ? `Your data will be deleted for good on ${day}.`
            : 'Your data will be deleted for good in 30 days.'}{' '}
          Changed your mind? Log in before then and everything stays as it was. We’ve emailed you about it
          too.
        </p>
      </div>
      <ButtonLink to="/">Done</ButtonLink>
      <ButtonLink to="/login" variant="text">
        Log in to keep my account
      </ButtonLink>
    </AuthScreen>
  );
}
