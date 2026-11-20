import { useRef, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ApiError } from '../../lib/api/ApiError';
import { Banner } from '../../components/ui/Banner';
import { Button, ButtonLink } from '../../components/ui/Button';
import { PasswordField } from '../../components/ui/PasswordField';
import { describeFailure, focusFirstInvalid } from '../auth/formErrors';
import { signOut } from '../auth/session';
import { AccountFormPage } from '../profile/AccountFormPage';
import { deleteAccount } from './privacyApi';

/** Closing the account, confirmed with the password. Logging in again within 30 days undoes it. */
export function DeleteAccountPage() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();

  const remove = useMutation({
    mutationFn: () => deleteAccount(password),
    onSuccess: async ({ removeAt }) => {
      // The server has already ended every session; this forgets it here too.
      await signOut();
      navigate(`/account-closed?removeAt=${encodeURIComponent(removeAt)}`, { replace: true });
    },
    onError: (failure) => {
      if (failure instanceof ApiError && failure.fieldErrors.password) {
        setError(failure.fieldErrors.password);
        requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      }
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!password) {
      setError('Enter your password.');
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    remove.mutate();
  }

  return (
    <AccountFormPage
      title="Delete my account"
      intro="Trips you host end for everyone, you leave the others, and you’re logged out everywhere. Your data is deleted for good after 30 days; log in before then to keep your account. Friends keep their trips with you shown as a former member."
    >
      <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-4">
        <PasswordField
          label="Your password"
          name="password"
          autoComplete="current-password"
          maxLength={128}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(undefined);
          }}
          error={error}
        />
        {remove.isError && !error && <Banner tone="error">{describeFailure(remove.error)}</Banner>}
        <Button type="submit" variant="danger" disabled={remove.isPending}>
          {remove.isPending ? 'Deleting…' : 'Delete my account'}
        </Button>
        <ButtonLink to="/me/privacy" variant="text">
          Keep my account
        </ButtonLink>
      </form>
    </AccountFormPage>
  );
}
