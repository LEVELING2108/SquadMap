import { useRef, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '../../lib/api/ApiError';
import { Banner } from '../../components/ui/Banner';
import { Button, ButtonLink } from '../../components/ui/Button';
import { PasswordField } from '../../components/ui/PasswordField';
import { TextField } from '../../components/ui/TextField';
import { checkEmail, describeFailure, focusFirstInvalid, type FieldErrors } from '../auth/formErrors';
import { useSession } from '../auth/session';
import { AccountFormPage } from './AccountFormPage';
import { changeEmail, rememberUser } from './accountApi';

/** A new email address for logging in, confirmed with the password. The old address gets a notice. */
export function ChangeEmailPage() {
  const user = useSession((state) => state.user);
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const change = useMutation({
    mutationFn: () => changeEmail(email.trim(), password),
    onSuccess: rememberUser,
    onError: (failure) => {
      if (!(failure instanceof ApiError)) return;
      const found: FieldErrors =
        failure.code === 'EMAIL_TAKEN'
          ? { email: 'Another account already uses this email.' }
          : { email: failure.fieldErrors.email, password: failure.fieldErrors.password };
      if (found.email || found.password) {
        setErrors(found);
        requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      }
    },
  });

  if (!user) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const found: FieldErrors = {
      email: checkEmail(email),
      password: password ? undefined : 'Enter your password.',
    };
    setErrors(found);
    if (found.email || found.password) {
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    change.mutate();
  }

  if (change.isSuccess) {
    return (
      <AccountFormPage title="Change email" intro="Log in with your new email address from now on.">
        <Banner tone="success">
          Your email is now {change.data.email}. We’ve sent a note to your old address in case this wasn’t
          you.
        </Banner>
        <ButtonLink to="/me">Back to profile</ButtonLink>
      </AccountFormPage>
    );
  }

  const fieldProblem = errors.email || errors.password;
  return (
    <AccountFormPage
      title="Change email"
      intro={`You log in with ${user.email}. After the change, we'll send a note to that address in case it wasn't you.`}
    >
      <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="New email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrors((was) => ({ ...was, email: undefined }));
          }}
          error={errors.email}
        />
        <PasswordField
          label="Your password"
          name="password"
          autoComplete="current-password"
          maxLength={128}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((was) => ({ ...was, password: undefined }));
          }}
          error={errors.password}
        />
        {change.isError && !fieldProblem && <Banner tone="error">{describeFailure(change.error)}</Banner>}
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? 'Changing…' : 'Change email'}
        </Button>
      </form>
    </AccountFormPage>
  );
}
