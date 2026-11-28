import { useEffect, useRef, useState } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { describeFailure } from '../auth/formErrors';
import { logOutOtherDevices } from './accountApi';

/** A row that ends every other session, after asking. Focus returns to the row when the dialog closes. */
export function LogOutOthers() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const rowRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const end = useMutation({ mutationFn: logOutOtherDevices, onSuccess: () => setOpen(false) });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <li>
      <button
        ref={rowRef}
        type="button"
        onClick={() => {
          end.reset();
          setOpen(true);
        }}
        className="flex min-h-[64px] w-full items-center gap-3.5 px-4 py-2.5 text-left"
      >
        <span
          aria-hidden="true"
          className="flex size-10 flex-none items-center justify-center rounded-control bg-red-bg text-red"
        >
          <MonitorSmartphone className="size-5" />
        </span>
        <span className="flex-1 text-base leading-[22px] font-bold">Log out everywhere else</span>
      </button>
      {end.isSuccess && (
        <div className="px-4 pb-3">
          <Banner tone="success">Logged out of every other device. This one stays logged in.</Banner>
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="logout-others-title"
        aria-describedby="logout-others-text"
        onClose={() => {
          setOpen(false);
          rowRef.current?.focus();
        }}
        onClick={(event) => event.target === dialogRef.current && setOpen(false)}
        className="glass-strong m-auto w-[min(360px,calc(100vw-32px))] rounded-sheet p-5 text-ink backdrop:bg-scrim backdrop:backdrop-blur-[4px]"
      >
        <h2 id="logout-others-title" className="text-lg leading-6 font-heading">
          Log out everywhere else?
        </h2>
        <p id="logout-others-text" className="mt-2 text-sm leading-5 text-muted">
          Every other phone or browser signed in to your account will need to log in again. This device stays
          logged in.
        </p>
        {end.isError && (
          <div className="mt-3">
            <Banner tone="error">{describeFailure(end.error)}</Banner>
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <Button onClick={() => end.mutate()} disabled={end.isPending}>
            {end.isPending ? 'Logging out…' : 'Log out other devices'}
          </Button>
          <Button variant="text" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </dialog>
    </li>
  );
}
