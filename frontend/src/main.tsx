import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './AppRoutes';
import { restoreSession } from './features/auth/session';
import { createQueryClient } from './lib/api/queryClient';
import { initTheme } from './lib/theme';
import { trackPageVisibility } from './motion/pageVisibility';
import './styles/index.css';

initTheme();
trackPageVisibility();
// Picks up an existing session from the refresh cookie; the page renders meanwhile.
void restoreSession();

const queryClient = createQueryClient();

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
