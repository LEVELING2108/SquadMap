import { useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Compass, Plane } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Banner } from '../../components/ui/Banner';
import { Button, ButtonLink } from '../../components/ui/Button';
import { PasswordField } from '../../components/ui/PasswordField';
import { TextField } from '../../components/ui/TextField';
import { logIn } from './authApi';
import { AuthScreen } from './AuthScreen';
import { checkEmail, describeFailure, focusFirstInvalid, hasErrors, type FieldErrors } from './formErrors';

/** Where to go after logging in: back to the page that sent the person here, or home. */
function useReturnPath(): string {
  const state = useLocation().state as { from?: { pathname?: string; search?: string } } | null;
  const from = state?.from?.pathname;
  return from && from !== '/login' ? `${from}${state?.from?.search ?? ''}` : '/home';
}

export function LoginPage() {
  const navigate = useNavigate();
  const returnPath = useReturnPath();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const login = useMutation({
    mutationFn: logIn,
    onSuccess: () => navigate(returnPath, { replace: true }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const found: FieldErrors = {
      email: checkEmail(email),
      password: password ? undefined : 'Enter your password.',
    };
    setErrors(found);
    if (hasErrors(found)) {
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    login.mutate({ email: email.trim(), password });
  }

  return (
    <AuthScreen
      titleId="login-title"
      topSpace={178}
      decoration={
        <>
          <Plane
            aria-hidden="true"
            className="motion-fly absolute top-24 left-0 size-8 fill-hero-plane text-blue-d"
            strokeWidth={2}
          />
          <p className="motion-rise absolute top-[76px] left-6 flex items-center gap-2 font-extrabold">
            <Compass aria-hidden="true" className="motion-spin size-6 text-blue" />
            SquadMap
          </p>
        </>
      }
    >
      <div className="motion-rise" style={{ '--motion-delay': '80ms' } as React.CSSProperties}>
        <h1 id="login-title" className="text-[28px] leading-[34px] font-extrabold tracking-[-0.5px]">
          Welcome back
        </h1>
        <p className="mt-1 text-sm leading-5 text-muted">Log in to pick up your next trip.</p>
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
          error={errors.email}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <div className="flex justify-end">
          <Link
            to="/forgot"
            state={{ email }}
            className="inline-flex min-h-11 items-center font-bold text-blue-d"
          >
            Forgot password?
          </Link>
        </div>

        {login.isError && <Banner tone="error">{describeFailure(login.error)}</Banner>}

        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <p className="flex min-h-11 items-center justify-center gap-1.5 text-sm leading-5 text-muted">
        New here?
        <Link to="/signup" className="inline-flex min-h-11 items-center font-bold text-blue-d">
          Create account
        </Link>
      </p>
      <ButtonLink to="/join" variant="text">
        Join a trip as guest
      </ButtonLink>
    </AuthScreen>
  );
}
