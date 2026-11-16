import { useRef, useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '../../lib/api/ApiError';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { describeFailure, focusFirstInvalid } from '../auth/formErrors';
import { useSession } from '../auth/session';
import { AccountFormPage } from './AccountFormPage';
import { rememberUser, updateProfile, useAvatarColors } from './accountApi';

const COLOR_NAMES: Record<string, string> = {
  '#0F6E56': 'Green',
  '#534AB7': 'Violet',
  '#993C1D': 'Rust',
  '#854F0B': 'Amber',
  '#993556': 'Berry',
};

/** Your name and colour, as friends see them on the trips you start or join from now on. */
export function EditProfilePage() {
  const user = useSession((state) => state.user);
  const colors = useAvatarColors();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(user?.name ?? '');
  const [color, setColor] = useState(user?.color ?? '');
  const [nameError, setNameError] = useState<string>();

  const save = useMutation({
    mutationFn: () => updateProfile({ name: name.trim(), color }),
    onSuccess: rememberUser,
    onError: (failure) => {
      if (failure instanceof ApiError && failure.fieldErrors.name) {
        setNameError(failure.fieldErrors.name);
        requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      }
    },
  });

  if (!user) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setNameError('Enter your name.');
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    save.mutate();
  }

  return (
    <AccountFormPage
      title="Edit profile"
      intro="Friends see this name and colour on trips you start or join from now on. Trips you've already been on keep the name you had then."
    >
      <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label="Your name"
          name="name"
          autoComplete="nickname"
          maxLength={60}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(undefined);
            save.reset();
          }}
          error={nameError}
        />

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 text-[13px] font-semibold text-muted">Your colour</legend>
          <div className="flex flex-wrap gap-3">
            {(colors.data ?? Object.keys(COLOR_NAMES)).map((option) => (
              <label
                key={option}
                className="relative flex size-12 cursor-pointer items-center justify-center rounded-pill text-on-person has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue"
                style={{ backgroundColor: option }}
              >
                <input
                  type="radio"
                  name="color"
                  value={option}
                  checked={color.toUpperCase() === option.toUpperCase()}
                  onChange={() => {
                    setColor(option);
                    save.reset();
                  }}
                  className="sr-only"
                />
                <span className="sr-only">{COLOR_NAMES[option.toUpperCase()] ?? option}</span>
                {color.toUpperCase() === option.toUpperCase() && (
                  <Check aria-hidden="true" className="size-6" />
                )}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center gap-3" aria-hidden="true">
          <span
            className="flex size-12 flex-none items-center justify-center rounded-pill text-lg font-extrabold text-on-person"
            style={{ backgroundColor: color }}
          >
            {(name.trim() || '?').charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-base font-bold">{name.trim() || 'Your name'}</span>
        </div>

        {save.isSuccess && <Banner tone="success">Saved. Friends will see this on your next trip.</Banner>}
        {save.isError && !nameError && <Banner tone="error">{describeFailure(save.error)}</Banner>}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </AccountFormPage>
  );
}
