import { useSyncExternalStore } from 'react';
import { useLocation } from 'react-router';
import { WifiOff } from 'lucide-react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** The live map (and its sheets) has its own offline banner with Retry. */
const LIVE_MAP = /^\/trip\/(?!new(\/|$))[^/]+(\/(eta|chat|menu|friend\/[^/]+))?\/?$/;

/** A small "You're offline" pill at the top centre of every screen, clear of the corner buttons. */
export function OfflineBar() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine);
  const { pathname } = useLocation();
  const show = !online && !LIVE_MAP.test(pathname);

  return (
    <div role="status" className="contents">
      {show && (
        <p className="motion-rise flex items-center gap-2 rounded-pill bg-amber-bg px-4 py-2 text-[13px] leading-[18px] font-bold text-amber shadow-sm">
          <WifiOff aria-hidden="true" className="size-4" />
          You’re offline
        </p>
      )}
    </div>
  );
}
