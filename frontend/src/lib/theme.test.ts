import { describe, expect, it, vi } from 'vitest';
import { setSystemPrefersDark } from '../test/matchMedia';
import {
  THEME_STORAGE_KEY,
  getThemeChoice,
  initTheme,
  resolveTheme,
  setThemeChoice,
  subscribeToTheme,
} from './theme';

const appliedTheme = () => document.documentElement.getAttribute('data-theme');

describe('theme', () => {
  it('follows the system setting when nothing has been chosen', () => {
    setSystemPrefersDark(true);
    initTheme();
    expect(getThemeChoice()).toBe('system');
    expect(appliedTheme()).toBe('dark');

    setSystemPrefersDark(false);
    expect(resolveTheme('system')).toBe('light');
  });

  it('applies and remembers an explicit choice, even against the system setting', () => {
    setSystemPrefersDark(true);
    setThemeChoice('light');

    expect(appliedTheme()).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(getThemeChoice()).toBe('light');
  });

  it('forgets the choice when set back to system', () => {
    setThemeChoice('dark');
    setThemeChoice('system');

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(appliedTheme()).toBe('light');
  });

  it('ignores an unknown stored value', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(getThemeChoice()).toBe('system');
  });

  it('re-applies when the system setting changes while on system', () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToTheme(onChange);
    initTheme();

    setSystemPrefersDark(true);
    expect(appliedTheme()).toBe('dark');
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('does not follow the system once a choice is made', () => {
    const unsubscribe = subscribeToTheme(() => {});
    setThemeChoice('light');

    setSystemPrefersDark(true);
    expect(appliedTheme()).toBe('light');

    unsubscribe();
  });

  it('still applies the theme when storage is blocked', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => setThemeChoice('dark')).not.toThrow();
    expect(appliedTheme()).toBe('dark');

    setItem.mockRestore();
  });
});
