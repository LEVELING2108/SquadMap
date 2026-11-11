import { useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { Mail } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Banner } from '../../components/ui/Banner';
import { Button, ButtonLink } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { requestResetLink } from './authApi';
import { AuthScreen } from './AuthScreen';
import { checkEmail, describeFailure, focusFirstInvalid } from './formErrors';

/**
 * The floating tile on the forgot and reset screens. It sits 60 px above the sheet, as in the
 * design, whatever the sheet's height.
 */
export function FloatingTile({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="motion-bob glass absolute bottom-15 left-1/2 -ml-10 flex size-20 items-center justify-center rounded-[28px] text-blue-d"
    >
      {children}
    </div>
  );
}

export function ForgotPasswordPage() {
  const prefill = (useLocation().state as { email?: string } | null)?.email ?? '';
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState(prefill);
  const [error, setError] = useState<string>();

  const request = useMutation({ mutationFn: requestResetLink });

  function submit(event: FormEvent) {
    event.preventDefault();
    const problem = checkEmail(email);
    setError(problem);
    if (problem) {
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    request.mutate(email.trim());
  }

  return (
    <AuthScreen
      titleId="forgot-title"
      topSpace={290}
      decoration={
        <FloatingTile>
          <Mail className="size-8" />
        </FloatingTile>
      }
    >
      <div className="motion-rise" style={{ '--motion-delay': '80ms' } as React.CSSProperties}>
        <h1 id="forgot-title" className="text-[28px] leading-[34px] font-extrabold tracking-[-0.5px]">
          Lost your way?
        </h1>
        <p className="mt-1 text-sm leading-5 text-muted">
          Enter your email and we will send a link to reset your password.
        </p>
      </div>

      <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-3">
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />
        <Button type="submit" disabled={request.isPending}>
          {request.isPending ? 'Sending…' : request.isSuccess ? 'Send again' : 'Send reset link'}
        </Button>
      </form>

      {/* The same message whether or not the email has an account: the server doesn't say either. */}
      {request.isSuccess && (
        <Banner tone="success">Sent! Check your inbox. The link works for 30 minutes.</Banner>
      )}
      {request.isError && <Banner tone="error">{describeFailure(request.error)}</Banner>}

      <ButtonLink to="/login" variant="text">
        Back to log in
      </ButtonLink>
    </AuthScreen>
  );
}
