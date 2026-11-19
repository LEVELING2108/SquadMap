import { useRegisterSW } from 'virtual:pwa-register/react';

/** How often an open app checks for a new version: trips last hours, so it shouldn't wait for a reload. */
const CHECK_EVERY_MS = 60 * 60_000;

/**
 * "A new version is ready": shown once a new version has downloaded. It never reloads by itself, so a live
 * trip isn't interrupted; Reload switches to the new version, Later keeps this one until the next visit.
 */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), CHECK_EVERY_MS);
    },
  });

  return (
    <div role="status" aria-live="polite" className="contents">
      {needRefresh && (
        <div className="glass-strong pointer-events-auto flex w-full max-w-[420px] items-center gap-2 rounded-card py-1.5 pr-1.5 pl-4 text-ink">
          <p className="flex-1 text-[15px] leading-5 font-bold">A new version is ready</p>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="min-h-11 rounded-pill px-3 text-[15px] font-bold text-muted"
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="min-h-11 rounded-pill bg-blue px-4 text-[15px] font-extrabold text-on-primary"
          >
            Reload
          </button>
        </div>
      )}
    </div>
  );
}
