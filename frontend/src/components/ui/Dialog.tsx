import { useEffect, useRef, type ReactNode } from 'react';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  /** The id of the dialog's heading. */
  labelledBy: string;
  /** The id of the sentence that explains it, if any. */
  describedBy?: string;
  children: ReactNode;
};

/**
 * A centred glass card over a dimmed page. A native dialog: it keeps focus inside, closes on Esc or a tap
 * outside, and gives focus back to whatever opened it. `onClose` reports only the person closing it.
 */
export function Dialog({ open, onClose, labelledBy, describedBy, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Closing because `open` turned false is not the person closing it, so it isn't reported back.
  const wanted = useRef(open);

  useEffect(() => {
    wanted.current = open;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClose={() => wanted.current && onClose()}
      onClick={(event) => event.target === dialogRef.current && onClose()}
      className="glass-strong m-auto w-[min(342px,calc(100vw-32px))] rounded-sheet p-6 text-ink backdrop:bg-scrim backdrop:backdrop-blur-[4px]"
    >
      {open && <div className="flex flex-col items-stretch gap-3.5 text-center">{children}</div>}
    </dialog>
  );
}
