import { create } from 'zustand';

/** Chrome's install offer, held back until the person asks to install. */
type InstallOffer = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type InstallState = {
  /** Set when the browser can install the app right now (Chrome and Edge on Android and desktop). */
  offer: InstallOffer | null;
  /** True when this page is already the installed app. */
  installed: boolean;
};

function runningInstalled(): boolean {
  const standalone =
    typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  return standalone || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export const useInstall = create<InstallState>(() => ({ offer: null, installed: runningInstalled() }));

/** Call once at startup: the browser makes its offer early, before any screen asks for it. */
export function listenForInstall(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    useInstall.setState({ offer: event as InstallOffer });
  });
  window.addEventListener('appinstalled', () => useInstall.setState({ offer: null, installed: true }));
}

/** Shows the browser's own install dialog. The offer can be used once. */
export async function installApp(): Promise<void> {
  const { offer } = useInstall.getState();
  if (!offer) return;
  await offer.prompt();
  const { outcome } = await offer.userChoice;
  useInstall.setState({ offer: null, installed: outcome === 'accepted' });
}

/** iPhone and iPad have no install offer: Safari's Share menu has "Add to Home Screen" instead. */
export function isAppleMobile(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}
