import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { FakeClient } from './fakeStomp';
import { setSystemPrefersDark } from './matchMedia';

// No test opens a real live connection; see fakeStomp.ts.
vi.mock('@stomp/stompjs', async () => (await import('./fakeStomp')).fakeStompModule);

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  setSystemPrefersDark(false);
  FakeClient.instances = [];
  FakeClient.autoConnect = true;
});

setSystemPrefersDark(false);
