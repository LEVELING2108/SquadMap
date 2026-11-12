import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { X } from 'lucide-react';

type QrDialogProps = { open: boolean; url: string; code: string; onClose: () => void };

/**
 * The invite link as a QR code, for a friend standing next to you. A native dialog: it traps focus,
 * closes on Esc, and returns focus to the button that opened it.
 */
export function QrDialog({ open, url, code, onClose }: QrDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then((markup) => !cancelled && setSvg(markup))
      .catch(() => !cancelled && setSvg(''));
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="qr-title"
      onClose={onClose}
      onClick={(event) => event.target === dialogRef.current && onClose()}
      className="glass-strong m-auto w-[min(340px,calc(100vw-32px))] rounded-sheet p-5 text-ink backdrop:bg-scrim backdrop:backdrop-blur-[4px]"
    >
      <div className="flex items-center justify-between">
        <h2 id="qr-title" className="text-base leading-[22px] font-bold">
          Scan to join
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-11 items-center justify-center rounded-pill text-muted"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
      <div
        role="img"
        aria-label={`QR code for the invite link to trip ${code}`}
        className="mx-auto mt-3 aspect-square w-full max-w-[260px] rounded-control bg-[white] p-2"
        // The library returns plain SVG markup generated from our own invite URL.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="mt-3 text-center text-sm leading-5 text-muted">
        Or type the code <span className="font-mono font-medium tracking-[2px] text-ink">{code}</span>
      </p>
    </dialog>
  );
}
