import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDistance } from '../../lib/map/geo';
import { jsonResponse, renderApp, testUser } from '../../test/renderApp';
import { useSession } from '../auth/session';
import { DEFAULT_SETTINGS, type Settings } from './settingsApi';

const fetchMock = vi.fn<typeof fetch>();
let saved: Settings;

/** A small stand-in server: stats, and settings that PATCH really changes. */
function serve(options: { failPatch?: boolean } = {}) {
  fetchMock.mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input).replace('/api/v1', '')}`;
    if (key === 'GET /me/stats') return jsonResponse(200, { trips: 12, friends: 9 });
    if (key === 'GET /me/settings') return jsonResponse(200, saved);
    if (key === 'PATCH /me/settings') {
      if (options.failPatch) return jsonResponse(503, { code: 'UNKNOWN', detail: 'Try again later.' });
      saved = { ...saved, ...(JSON.parse(String(init!.body)) as Partial<Settings>) };
      return jsonResponse(200, saved);
    }
    if (key === 'POST /auth/logout') return new Response(null, { status: 204 });
    throw new Error(`Unexpected call: ${key}`);
  });
}

beforeEach(() => {
  useSession.setState({ status: 'signedIn', user: testUser, guest: null, accessToken: 't' });
  saved = { ...DEFAULT_SETTINGS };
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('Profile', () => {
  it('shows who you are and your numbers', async () => {
    serve();
    renderApp('/me');

    expect(screen.getByRole('heading', { level: 1, name: 'Priya' })).toBeInTheDocument();
    expect(screen.getByText('Explorer since Nov 2026')).toBeInTheDocument();
    const numbers = screen.getByLabelText('Your numbers');
    await waitFor(() => expect(numbers).toHaveTextContent('12Trips9Friends'));
  });

  it('leads to trip history and settings, and marks You as the current tab', () => {
    serve();
    renderApp('/me');

    const account = screen.getByRole('navigation', { name: 'Your account' });
    expect(within(account).getByRole('link', { name: 'Trip history' })).toHaveAttribute(
      'href',
      '/me/history',
    );
    expect(within(account).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/me/settings');
    const tabs = screen.getByRole('navigation', { name: 'Main' });
    expect(within(tabs).getByRole('link', { name: 'You' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getByRole('link', { name: 'Trips' })).not.toHaveAttribute('aria-current');
  });

  it('logs out', async () => {
    const user = userEvent.setup();
    serve();
    renderApp('/me');

    await user.click(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(useSession.getState().status).toBe('signedOut'));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/'));
  });
});

describe('Settings', () => {
  it('shows the saved settings', async () => {
    saved = { ...DEFAULT_SETTINGS, darkMap: true, distanceUnit: 'mi', defaultShareHours: 2 };
    serve();
    renderApp('/me/settings', { settings: null });

    await waitFor(() => expect(screen.getByRole('switch', { name: 'Dark map' })).toBeChecked());
    expect(screen.getByRole('radio', { name: 'Miles' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Default sharing time, 2 h' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Map style, Streets' })).toBeInTheDocument();
  });

  it('saves each change straight away', async () => {
    const user = userEvent.setup();
    serve();
    renderApp('/me/settings', { settings: null });
    await screen.findByRole('switch', { name: 'Dark map' });

    await user.click(screen.getByRole('switch', { name: 'Dark map' }));
    await user.click(screen.getByRole('radio', { name: 'Miles' }));
    await user.click(screen.getByRole('button', { name: /^Default sharing time/ }));
    await user.click(screen.getByRole('radio', { name: '8 hours' }));

    await waitFor(() =>
      expect(saved).toEqual({ ...DEFAULT_SETTINGS, darkMap: true, distanceUnit: 'mi', defaultShareHours: 8 }),
    );
    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(patches.map(([, init]) => JSON.parse(String(init!.body)))).toEqual([
      { darkMap: true },
      { distanceUnit: 'mi' },
      { defaultShareHours: 8 },
    ]);
  });

  it('puts a setting back and says so when it could not be saved', async () => {
    const user = userEvent.setup();
    serve({ failPatch: true });
    renderApp('/me/settings', { settings: null });
    const darkMap = await screen.findByRole('switch', { name: 'Dark map' });

    await user.click(darkMap);

    expect(await screen.findByRole('alert')).toHaveTextContent('Your change wasn’t saved.');
    expect(darkMap).not.toBeChecked();
  });

  it('picks the theme for this device from a sheet, without saving it to the account', async () => {
    const user = userEvent.setup();
    serve();
    renderApp('/me/settings', { settings: null });

    await user.click(screen.getByRole('button', { name: 'Theme, Match my phone' }));
    const sheet = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(within(sheet).getByRole('radio', { name: /Match my phone/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(within(sheet).getByRole('radio', { name: /Atlas/ }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('atlas');
    expect(screen.getByRole('button', { name: 'Theme, Atlas' })).toBeInTheDocument();
    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(patches).toEqual([]);
  });

  it('changes the map style from a sheet and saves it', async () => {
    const user = userEvent.setup();
    serve();
    renderApp('/me/settings', { settings: null });

    await user.click(await screen.findByRole('button', { name: /^Map style/ }));
    await user.click(screen.getByRole('radio', { name: /Satellite/ }));

    await waitFor(() => expect(saved).toEqual({ ...DEFAULT_SETTINGS, mapStyle: 'satellite' }));
    expect(screen.getByRole('button', { name: 'Map style, Satellite' })).toBeInTheDocument();
  });
});

describe('distances in miles', () => {
  it.each([
    [100, '330 ft'],
    [6200, '3.9 mi'],
    [16_093, '10 mi'],
    [24_400, '15 mi'],
  ])('%s m reads %j', (meters, words) => {
    expect(formatDistance(meters, 'mi')).toBe(words);
  });
});
