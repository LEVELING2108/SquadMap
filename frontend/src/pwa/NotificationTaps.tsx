import { useEffect } from 'react';
import { useNavigate } from 'react-router';

/**
 * A tapped notification asks the open app to show a screen: it moves there in place, so a live trip
 * isn't reloaded. Only paths inside the app are followed.
 */
export function NotificationTaps() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const worker = navigator.serviceWorker;
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; path?: unknown } | null;
      if (data?.type !== 'OPEN_PATH' || typeof data.path !== 'string') return;
      if (!data.path.startsWith('/') || data.path.startsWith('//')) return;
      navigate(data.path);
    }
    worker.addEventListener('message', onMessage);
    return () => worker.removeEventListener('message', onMessage);
  }, [navigate]);

  return null;
}
