import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Hexagon } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '../../lib/api/ApiError';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { PasswordField } from '../../components/ui/PasswordField';
import { TextField } from '../../components/ui/TextField';
import { signUp } from './authApi';
import { AuthScreen } from './AuthScreen';
import {
  checkEmail,
  checkNewPassword,
  describeFailure,
  focusFirstInvalid,
  hasErrors,
  type FieldErrors,
} from './formErrors';
import { StrengthMeter } from './StrengthMeter';

export function SignupPage() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const signup = useMutation({
    mutationFn: signUp,
    onSuccess: () => navigate('/home', { replace: true }),
    onError: (error) => {
      // Problems with a specific field are shown on that field, not in the banner.
      if (
        error instanceof ApiError &&
        (error.code === 'EMAIL_TAKEN' || Object.keys(error.fieldErrors).length)
      ) {
        setErrors(error.code === 'EMAIL_TAKEN' ? { email: error.detail } : error.fieldErrors);
        requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      }
    },
  });

  const fieldLevelFailure =
    signup.error instanceof ApiError &&
    (signup.error.code === 'EMAIL_TAKEN' || Object.keys(signup.error.fieldErrors).length > 0);

  function submit(event: FormEvent) {
    event.preventDefault();
    signup.reset();
    const found: FieldErrors = {
      name: name.trim() ? undefined : 'Enter your name.',
      email: checkEmail(email),
      password: checkNewPassword(password),
      acceptedTerms: acceptedTerms ? undefined : 'Agree to the Terms and Privacy Policy to continue.',
    };
    setErrors(found);
    if (hasErrors(found)) {
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    signup.mutate({ name: name.trim(), email: email.trim(), password, acceptedTerms });
  }

  return (
    <AuthScreen
      titleId="signup-title"
      topSpace={136}
      decoration={
        <p className="motion-rise glass absolute top-20 left-6 flex w-max items-center gap-2 rounded-[16px] px-3.5 py-2 text-[13px] font-bold">
          <Hexagon aria-hidden="true" className="size-4 text-coral-d" />
          Your passport to group trips
        </p>
      }
    >
      <div className="motion-rise" style={{ '--motion-delay': '80ms' } as React.CSSProperties}>
        <h1 id="signup-title" className="text-[28px] leading-[34px] font-extrabold tracking-[-0.5px]">
          Create account
        </h1>
        <p className="mt-1 text-sm leading-5 text-muted">Free, takes under a minute.</p>
      </div>

      <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-3">
        <TextField
          label="Name"
          name="name"
          autoComplete="name"
          placeholder="What friends call you"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={<StrengthMeter password={password} />}
        />

        <div className="flex flex-col gap-1">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              name="acceptedTerms"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              aria-invalid={errors.acceptedTerms ? true : undefined}
              aria-describedby={errors.acceptedTerms ? 'terms-error' : undefined}
              className="size-6 flex-none accent-blue"
            />
            <span className="text-[13px] leading-[18px] text-muted">
              I agree to the{' '}
              <Link to="/privacy" className="-my-3.5 inline-block py-3.5 font-bold text-blue-d">
                Terms and Privacy Policy
              </Link>
            </span>
          </label>
          {errors.acceptedTerms && (
            <p id="terms-error" className="text-[13px] leading-[18px] font-semibold text-red">
              {errors.acceptedTerms}
            </p>
          )}
        </div>

        {signup.isError && !fieldLevelFailure && (
          <Banner tone="error">{describeFailure(signup.error)}</Banner>
        )}

        <Button type="submit" disabled={signup.isPending}>
          {signup.isPending ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>

      <p className="flex min-h-11 items-center justify-center gap-1.5 text-sm leading-5 text-muted">
        Have an account?
        <Link to="/login" className="inline-flex min-h-11 items-center font-bold text-blue-d">
          Log in
        </Link>
      </p>
    </AuthScreen>
  );
}
