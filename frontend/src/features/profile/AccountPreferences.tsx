import { useEffect } from 'react';
import { useSession } from '../auth/session';
import { useSettings } from './settingsApi';
import { markReducedMotion, rememberReducedMotion } from './reducedMotion';

/**
 * Applies account settings that change the whole page. "Reduce animations" marks <html>, and the
 * stylesheets then stop motion as they do for the device's own reduced-motion preference. The choice is
 * also remembered on this device (it holds nothing personal), so the next visit starts without motion.
 */
export function AccountPreferences() {
  const signedIn = useSession((state) => state.status === 'signedIn');
  const signedOut = useSession((state) => state.status === 'signedOut' || state.status === 'guest');
  const { data } = useSettings();

  useEffect(() => {
    // Until the account's own settings arrive, keep whatever was applied at start.
    let on: boolean;
    if (signedIn && data) on = data.reduceMotion;
    else if (signedOut) on = false;
    else return;
    markReducedMotion(on);
    rememberReducedMotion(on);
  }, [signedIn, signedOut, data]);
  return null;
}
