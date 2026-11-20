import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toArea } from '../../lib/map/geo';
import { jsonResponse, renderApp, testUser } from '../../test/renderApp';
import { useSession } from '../auth/session';
import { roughly } from '../live/useLocationSharing';
import { DEFAULT_SETTINGS, type Settings } from '../profile/settingsApi';

const fetchMock = vi.fn<typeof fetch>();
let saved: Settings;

function serve() {
  fetchMock.mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input).replace('/api/v1', '')}`;
    if (key === 'GET /me/settings') return jsonResponse(200, saved);
    if (key === 'PATCH /me/settings') {
      saved = { ...saved, ...(JSON.parse(String(init?.body)) as Partial<Settings>) };
      return jsonResponse(200, saved);
    }
    if (key === 'POST /me/trips/forget') return jsonResponse(200, { removed: 3 });
    throw new Error(`Unexpected call: ${key}`);
  });
}

const calls = (key: string) =>
  fetchMock.mock.calls.filter(([input, init]) => `${init?.method ?? 'GET'} ${String(input)}` === key);

beforeEach(() => {
  saved = { ...DEFAULT_SETTINGS };
  vi.stubGlobal('fetch', fetchMock);
  useSession.setState({ status: 'signedIn', user: testUser, guest: null, accessToken: 't' });
  serve();
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('The privacy switches', () => {
  it('turns precise location off and on', async () => {
    renderApp('/me/privacy');
    const precise = await screen.findByRole('switch', { name: 'Share precise location' });
    expect(precise).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(precise);

    await waitFor(() => expect(saved.preciseLocation).toBe(false));
    expect(precise).toHaveAttribute('aria-checked', 'false');
  });

  it('shows auto-stop as always on, with nothing to switch', async () => {
    renderApp('/me/privacy');

    expect(await screen.findByText('Auto-stop at trip end')).toBeInTheDocument();
    expect(screen.getByText('Always on')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /Auto-stop/ })).not.toBeInTheDocument();
  });

  it('asks before keeping no history, and can remove past trips too', async () => {
    renderApp('/me/privacy');

    await userEvent.click(await screen.findByRole('switch', { name: 'Keep trip history' }));
    expect(screen.getByRole('dialog', { name: 'Stop keeping trip history?' })).toBeInTheDocument();
    expect(saved.keepHistory).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Remove past trips too' }));

    await waitFor(() => expect(saved.keepHistory).toBe(false));
    expect(await screen.findByText('Removed 3 past trips from your history.')).toBeInTheDocument();
    expect(calls('POST /api/v1/me/trips/forget')).toHaveLength(1);
  });

  it('can keep past trips, or change nothing', async () => {
    renderApp('/me/privacy');
    const history = await screen.findByRole('switch', { name: 'Keep trip history' });

    await userEvent.click(history);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(saved.keepHistory).toBe(true);

    await userEvent.click(history);
    await userEvent.click(screen.getByRole('button', { name: 'Only from now on' }));
    await waitFor(() => expect(saved.keepHistory).toBe(false));
    expect(calls('POST /api/v1/me/trips/forget')).toHaveLength(0);

    // Back on needs no question.
    await userEvent.click(history);
    await waitFor(() => expect(saved.keepHistory).toBe(true));
  });
});

describe('A rough area', () => {
  it('is the same for every spot inside it, about 220 m across', () => {
    expect(toArea(18.56101, 73.91201)).toEqual(toArea(18.56149, 73.91249));
    expect(toArea(18.56123, 73.91234)).toEqual({ lat: 18.562, lng: expect.any(Number) });
    const one = toArea(18.561, 73.912);
    const north = toArea(18.563, 73.912);
    expect(north.lat - one.lat).toBeCloseTo(0.002, 6);
  });

  it('keeps only the area, the accuracy and the time', () => {
    expect(
      roughly({ lat: 18.56123, lng: 73.91234, acc: 8, speed: 4.2, heading: 90, ts: '2026-11-21T10:00:00Z' }),
    ).toEqual({ ...toArea(18.56123, 73.91234), acc: 8, ts: '2026-11-21T10:00:00Z', approximate: true });
  });
});
