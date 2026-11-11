import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { setSystemPrefersDark } from './matchMedia';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  setSystemPrefersDark(false);
});

setSystemPrefersDark(false);
