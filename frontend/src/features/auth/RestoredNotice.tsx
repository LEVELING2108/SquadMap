import { X } from 'lucide-react';
import { useSession } from './session';

/** After logging in to an account that was waiting to be deleted: it's kept, and here's the proof. */
export function RestoredNotice() {
  const restored = useSession((state) => state.accountRestored === true);

  return (
    <div role="status" className="contents">
      {restored && (
        <div className="glass-strong pointer-events-auto flex w-full max-w-[420px] items-center gap-2 rounded-card py-1.5 pr-1.5 pl-4 text-ink">
          <p className="flex-1 text-[15px] leading-5 font-bold">
            Welcome back. Your account is no longer being deleted.
          </p>
          <button
            type="button"
            aria-label="Close"
            onClick={() => useSession.setState({ accountRestored: false })}
            className="flex size-11 flex-none items-center justify-center rounded-pill text-muted"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}
