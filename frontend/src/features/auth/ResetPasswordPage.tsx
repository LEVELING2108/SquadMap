import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { KeyRound, LinkIcon } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '../../lib/api/ApiError';
import { Banner } from '../../components/ui/Banner';
import { Button, ButtonLink } from '../../components/ui/Button';
import { PasswordField } from '../../components/ui/PasswordField';
import { resetPassword } from './authApi';
import { AuthScreen } from './AuthScreen';
import { FloatingTile } from './ForgotPasswordPage';
import { checkNewPassword, describeFailure, focusFirstInvalid } from './formErrors';
import { StrengthMeter } from './StrengthMeter';

function tokenFrom(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token');
  return token && token.length <= 100 ? token : null;
}

/**
 * Landing page for the emailed reset link. The token arrives after "#", so it never reaches a
 * server log; it is read once and then removed from the address bar and browser history.
 */
export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => tokenFrom(location.hash));
  const formRef = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (location.hash) navigate({ pathname: location.pathname }, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  const reset = useMutation({
    mutationFn: (newPassword: string) => resetPassword(token ?? '', newPassword),
    onError: (failure) => {
      const fieldMessage = failure instanceof ApiError ? failure.fieldErrors.password : undefined;
      if (fieldMessage) {
        setError(fieldMessage);
        requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      }
    },
  });

  const linkInvalid =
    !token || (reset.error instanceof ApiError && reset.error.code === 'RESET_LINK_INVALID');

  function submit(event: FormEvent) {
    event.preventDefault();
    const problem = checkNewPassword(password);
    setError(problem);
    if (problem) {
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    reset.mutate(password);
  }

  if (linkInvalid) {
    return (
      <AuthScreen
        titleId="reset-title"
        topSpace={290}
        decoration={
          <FloatingTile>
            <LinkIcon className="size-8" />
          </FloatingTile>
        }
      >
        <div className="motion-rise">
          <h1 id="reset-title" className="text-[28px] leading-[34px] font-extrabold tracking-[-0.5px]">
            This link has expired
          </h1>
          <p className="mt-1 text-sm leading-5 text-muted">
            Reset links work once, for 30 minutes, and only the newest one you asked for. Request a new one
            and use it from the latest email.
          </p>
        </div>
        <ButtonLink to="/forgot">Request a new link</ButtonLink>
        <ButtonLink to="/login" variant="text">
          Back to log in
        </ButtonLink>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      titleId="reset-title"
      topSpace={290}
      decoration={
        <FloatingTile>
          <KeyRound className="size-8" />
        </FloatingTile>
      }
    >
      <div className="motion-rise" style={{ '--motion-delay': '80ms' } as React.CSSProperties}>
        <h1 id="reset-title" className="text-[28px] leading-[34px] font-extrabold tracking-[-0.5px]">
          {reset.isSuccess ? 'Password changed' : 'Choose a new password'}
        </h1>
        <p className="mt-1 text-sm leading-5 text-muted">
          {reset.isSuccess
            ? 'You have been signed out everywhere. Log in with your new password.'
            : 'Once it is saved, you will be signed out on every device.'}
        </p>
      </div>

      {reset.isSuccess ? (
        <>
          <Banner tone="success">Your new password is saved.</Banner>
          <ButtonLink to="/login" replace>
            Log in
          </ButtonLink>
        </>
      ) : (
        <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-3">
          <PasswordField
            label="New password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
            hint={<StrengthMeter password={password} />}
          />
          {reset.isError && !error && <Banner tone="error">{describeFailure(reset.error)}</Banner>}
          <Button type="submit" disabled={reset.isPending}>
            {reset.isPending ? 'Saving…' : 'Save new password'}
          </Button>
        </form>
      )}
    </AuthScreen>
  );
}
