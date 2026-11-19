import { ChevronRight, Smartphone } from 'lucide-react';
import { installApp, isAppleMobile, useInstall } from './installPrompt';

const tile = 'flex size-10 flex-none items-center justify-center rounded-control bg-tint text-blue-d';

/**
 * "Install SquadMap" on the You tab: the browser's install dialog where there is one, the Share-menu
 * steps on iPhone, and nothing once the app is installed or where it can't be.
 */
export function InstallRow() {
  const offer = useInstall((state) => state.offer);
  const installed = useInstall((state) => state.installed);

  if (installed) return null;
  if (offer) {
    return (
      <li>
        <button
          type="button"
          onClick={() => void installApp()}
          className="flex min-h-[64px] w-full items-center gap-3.5 px-4 py-2.5 text-left"
        >
          <span aria-hidden="true" className={tile}>
            <Smartphone className="size-5" />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="text-base leading-[22px] font-bold">Install SquadMap</span>
            <span className="text-[13px] leading-[18px] text-muted">Open it from your home screen</span>
          </span>
          <ChevronRight aria-hidden="true" className="size-5 text-muted" />
        </button>
      </li>
    );
  }
  if (isAppleMobile()) {
    return (
      <li className="flex min-h-[64px] items-center gap-3.5 px-4 py-2.5">
        <span aria-hidden="true" className={tile}>
          <Smartphone className="size-5" />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-base leading-[22px] font-bold">Install SquadMap</span>
          <span className="text-[13px] leading-[18px] text-muted">
            In Safari, tap Share, then Add to Home Screen
          </span>
        </span>
      </li>
    );
  }
  return null;
}
