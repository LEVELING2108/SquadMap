import { useRef, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '../../lib/api/ApiError';
import { Banner } from '../../components/ui/Banner';
import { Button, ButtonLink } from '../../components/ui/Button';
import { PasswordField } from '../../components/ui/PasswordField';
import { checkNewPassword, describeFailure, focusFirstInvalid, type FieldErrors } from '../auth/formErrors';
import { StrengthMeter } from '../auth/StrengthMeter';
import { AccountFormPage } from './AccountFormPage';
import { changePassword } from './accountApi';

/** A new password, confirmed with the current one. Other devices are logged out; this one stays in. */
export function ChangePasswordPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const change = useMutation({
    mutationFn: () => changePassword(current, next),
    onError: (failure) => {
      if (failure instanceof ApiError && Object.keys(failure.fieldErrors).length > 0) {
        setErrors({
          currentPassword: failure.fieldErrors.currentPassword,
          newPassword: failure.fieldErrors.newPassword,
        });
        requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      }
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const found: FieldErrors = {
      currentPassword: current ? undefined : 'Enter your current password.',
      newPassword: checkNewPassword(next),
    };
    setErrors(found);
    if (found.currentPassword || found.newPassword) {
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    change.mutate();
  }

  if (change.isSuccess) {
    return (
      <AccountFormPage title="Change password" intro="Use your new password next time you log in.">
        <Banner tone="success">Password changed. Your other devices have been logged out.</Banner>
        <ButtonLink to="/me">Back to profile</ButtonLink>
      </AccountFormPage>
    );
  }

  const fieldProblem = errors.currentPassword || errors.newPassword;
  return (
    <AccountFormPage
      title="Change password"
      intro="Every other phone or browser signed in to your account will be logged out. This one stays logged in."
    >
      <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-4">
        <PasswordField
          label="Current password"
          name="currentPassword"
          autoComplete="current-password"
          maxLength={128}
          value={current}
          onChange={(e) => {
            setCurrent(e.target.value);
            setErrors((was) => ({ ...was, currentPassword: undefined }));
          }}
          error={errors.currentPassword}
        />
        <PasswordField
          label="New password"
          name="newPassword"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          maxLength={128}
          value={next}
          onChange={(e) => {
            setNext(e.target.value);
            setErrors((was) => ({ ...was, newPassword: undefined }));
          }}
          error={errors.newPassword}
          hint={<StrengthMeter password={next} />}
        />
        {change.isError && !fieldProblem && <Banner tone="error">{describeFailure(change.error)}</Banner>}
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? 'Changing…' : 'Change password'}
        </Button>
      </form>
    </AccountFormPage>
  );
}
