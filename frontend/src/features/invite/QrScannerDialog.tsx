import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { codeFromScan } from './joinApi';
import { cameraProblem, createFrameReader, type CameraProblem } from './qrReader';

type QrScannerDialogProps = { open: boolean; onClose: () => void; onCode: (code: string) => void };

const problemMessages: Record<CameraProblem, string> = {
  blocked:
    'Camera access is blocked for this site. Allow it in your browser’s site settings, or type the code instead.',
  missing: 'No camera was found. Type the trip code instead.',
  unsupported: 'This browser can’t use the camera here. Type the trip code instead.',
  failed: 'The camera couldn’t start. Close this and try again, or type the code.',
};

/** How often a frame is checked for a QR code. */
const SCAN_INTERVAL_MS = 200;

/**
 * Scans the host's QR code with the camera and hands back the trip code. The camera starts only
 * while the dialog is open and stops the moment a code is read or the dialog closes.
 */
export function QrScannerDialog({ open, onClose, onCode }: QrScannerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="scan-title"
      aria-describedby="scan-help"
      onClose={onClose}
      onClick={(event) => event.target === dialogRef.current && onClose()}
      className="glass-strong m-auto w-[min(360px,calc(100vw-32px))] rounded-sheet p-5 text-ink backdrop:bg-scrim backdrop:backdrop-blur-[4px]"
    >
      <div className="flex items-center justify-between">
        <h2 id="scan-title" className="text-base leading-[22px] font-bold">
          Scan the trip QR code
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
      {/* Mounted only while open, so each opening starts the camera afresh and closing always stops it. */}
      {open && <CameraView onCode={onCode} />}
      <p id="scan-help" className="mt-3 text-center text-sm leading-5 text-muted">
        Point your camera at the QR code on your host’s screen.
      </p>
    </dialog>
  );
}

function CameraView({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<CameraProblem>();
  const [notAnInvite, setNotAnInvite] = useState(false);
  // The latest callback, so a new function from the parent doesn't restart the camera.
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    const video = videoRef.current;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function stopCamera() {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      if (video) video.srcObject = null;
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        // Also the case on plain http away from localhost: browsers allow cameras only on secure pages.
        setProblem('unsupported');
        return;
      }
      try {
        const [media, read] = await Promise.all([
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }),
          createFrameReader(),
        ]);
        stream = media;
        if (stopped || !video) return stopCamera();
        video.srcObject = media;
        await video.play();

        const scan = async () => {
          if (stopped) return;
          const text = await read(video).catch(() => null);
          if (stopped) return;
          if (text !== null) {
            const code = codeFromScan(text);
            if (code) {
              stopCamera();
              onCodeRef.current(code);
              return;
            }
            setNotAnInvite(true);
          }
          timer = setTimeout(() => void scan(), SCAN_INTERVAL_MS);
        };
        void scan();
      } catch (error) {
        stopCamera();
        if (!stopped) setProblem(cameraProblem(error));
      }
    }

    void start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stopCamera();
    };
  }, []);

  return (
    <>
      {problem ? (
        <p
          role="alert"
          className="mt-3 rounded-control bg-red-bg px-3.5 py-3 text-[13px] leading-[18px] font-bold text-red"
        >
          {problemMessages[problem]}
        </p>
      ) : (
        <div className="relative mx-auto mt-3 aspect-square w-full max-w-[300px] overflow-hidden rounded-control bg-ink">
          {/* The live picture only helps aim the camera; screen readers get the instructions instead. */}
          <video ref={videoRef} aria-hidden="true" muted playsInline className="size-full object-cover" />
          <div
            aria-hidden="true"
            className="absolute inset-[18%] rounded-control border-[3px] border-on-scrim/90"
          />
        </div>
      )}
      <p role="status" className="mt-2 min-h-5 text-center text-[13px] leading-5 font-bold text-amber">
        {notAnInvite && !problem ? 'That QR code isn’t a SquadMap invite.' : ''}
      </p>
    </>
  );
}
