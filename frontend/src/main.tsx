import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './AppRoutes';
import { restoreSession } from './features/auth/session';
import { AccountPreferences } from './features/profile/AccountPreferences';
import { applyRememberedPreferences } from './features/profile/reducedMotion';
import { createQueryClient } from './lib/api/queryClient';
import { initTheme } from './lib/theme';
import { trackPageVisibility } from './motion/pageVisibility';
import { listenForInstall } from './pwa/installPrompt';
import { OfflineBar } from './pwa/OfflineBar';
import { UpdateToast } from './pwa/UpdateToast';
import './styles/index.css';

initTheme();
applyRememberedPreferences();
trackPageVisibility();
listenForInstall();
// Picks up an existing session from the refresh cookie; the page renders meanwhile.
void restoreSession();

const queryClient = createQueryClient();

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AccountPreferences />
      <BrowserRouter>
        <AppRoutes />
        {/* App-wide notices float over every screen, below the phone's status bar. */}
        <div className="pointer-events-none fixed inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-50 mx-auto flex max-w-[600px] flex-col items-center gap-2 px-3">
          <OfflineBar />
          <UpdateToast />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
