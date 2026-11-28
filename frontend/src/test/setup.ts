import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { FakeClient } from './fakeStomp';
import { setSystemPrefersDark } from './matchMedia';

// jsdom has no native dialog; give it just enough to open and close (Dialog, ChoiceSheet and others).
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close'));
};

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
