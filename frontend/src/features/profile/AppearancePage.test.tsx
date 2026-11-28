import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp, testUser } from '../../test/renderApp';
import { setSystemPrefersDark } from '../../test/matchMedia';
import { useSession } from '../auth/session';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  useSession.setState({ status: 'signedIn', user: testUser, guest: null, accessToken: 't' });
});

afterEach(() => {
  fetchMock.mockReset();
});

describe('Appearance', () => {
  it('offers the four looks, with this device’s choice picked', () => {
    window.localStorage.setItem('squadmap.theme', 'dark');
    renderApp('/me/appearance');

    expect(screen.getByRole('heading', { level: 1, name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      'system',
      'light',
      'dark',
      'atlas',
    ]);
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Atlas' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Atlas' })).toHaveAccessibleDescription(
      'Warm paper, forest ink and vermilion routes',
    );
  });

  it('changes the look at once, remembers it on this device and saves nothing to the account', async () => {
    const user = userEvent.setup();
    renderApp('/me/appearance');

    await user.click(screen.getByRole('radio', { name: 'Atlas' }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('atlas');
    expect(window.localStorage.getItem('squadmap.theme')).toBe('atlas');
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toEqual([]);
  });

  it('follows the phone again with Match my phone', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('squadmap.theme', 'atlas');
    setSystemPrefersDark(true);
    renderApp('/me/appearance');

    await user.click(screen.getByRole('radio', { name: 'Match my phone' }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem('squadmap.theme')).toBeNull();
  });

  it('draws each preview in its own theme, whatever the page is showing', () => {
    renderApp('/me/appearance');

    const themes = [...document.querySelectorAll('fieldset [data-theme]')].map((swatch) =>
      swatch.getAttribute('data-theme'),
    );
    expect(themes).toEqual(['light', 'dark', 'light', 'dark', 'atlas']);
  });
});
