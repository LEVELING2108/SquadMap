import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderApp, testUser } from '../../test/renderApp';
import { RestoredNotice } from '../auth/RestoredNotice';
import { setSignedIn, useSession } from '../auth/session';
import { DEFAULT_SETTINGS } from '../profile/settingsApi';
import { longDate } from './privacyApi';

const fetchMock = vi.fn<typeof fetch>();

type Routes = Record<string, (init?: RequestInit) => Response>;

function serve(routes: Routes) {
  fetchMock.mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input).replace('/api/v1', '')}`;
    const answer = routes[key];
    if (!answer) throw new Error(`Unexpected call: ${key}`);
    return answer(init);
  });
}

const calls = (key: string) =>
  fetchMock.mock.calls.filter(([input, init]) => `${init?.method ?? 'GET'} ${String(input)}` === key);

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  useSession.setState({
    status: 'signedIn',
    user: testUser,
    guest: null,
    accessToken: 't',
    accountRestored: false,
  });
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Privacy and data', () => {
  it('says how location is kept private and leads to the policy and to deleting the account', async () => {
    serve({});
    renderApp('/me/privacy');

    expect(await screen.findByRole('heading', { name: 'Privacy and data' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your location is private' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Terms and Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(screen.getByRole('link', { name: 'Delete my account' })).toHaveAttribute('href', '/me/delete');
    expect(screen.getByText('You can withdraw consent at any time.')).toBeInTheDocument();
  });

  it('saves a copy of everything kept as a file', async () => {
    serve({ 'GET /me/export': () => jsonResponse(200, { account: { name: 'Priya' } }) });
    const created = vi.fn<(blob: Blob) => string>(() => 'blob:squadmap');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderApp('/me/privacy');

    await userEvent.click(await screen.findByRole('button', { name: /Download my data/ }));

    expect(await screen.findByText('Your data is saved as squadmap-data.json.')).toBeInTheDocument();
    expect(click).toHaveBeenCalledTimes(1);
    const saved = created.mock.calls[0]?.[0];
    expect(JSON.parse(await saved!.text())).toEqual({ account: { name: 'Priya' } });
  });

  it('says so when the copy can’t be made', async () => {
    serve({ 'GET /me/export': () => jsonResponse(429, { code: 'RATE_LIMITED', detail: 'Too many tries.' }) });
    renderApp('/me/privacy');

    await userEvent.click(await screen.findByRole('button', { name: /Download my data/ }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('is on the profile', async () => {
    serve({
      'GET /me/stats': () => jsonResponse(200, { trips: 1, friends: 1 }),
      'GET /me/alerts/unread-count': () => jsonResponse(200, { unread: 0 }),
      'GET /me/settings': () => jsonResponse(200, DEFAULT_SETTINGS),
    });
    renderApp('/me');
    expect(await screen.findByRole('link', { name: 'Privacy and data' })).toHaveAttribute(
      'href',
      '/me/privacy',
    );
  });
});

describe('Delete my account', () => {
  it('asks for the password first', async () => {
    serve({});
    renderApp('/me/delete');

    await userEvent.click(await screen.findByRole('button', { name: 'Delete my account' }));

    expect(await screen.findByText('Enter your password.')).toBeInTheDocument();
    expect(calls('DELETE /api/v1/me')).toHaveLength(0);
  });

  it('shows a wrong password on the field', async () => {
    serve({
      'DELETE /me': () =>
        jsonResponse(400, {
          code: 'VALIDATION_FAILED',
          detail: 'One or more fields are invalid.',
          errors: [{ field: 'password', message: 'That isn’t your current password.' }],
        }),
    });
    renderApp('/me/delete');

    await userEvent.type(await screen.findByLabelText('Your password'), 'wrong one');
    await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }));

    expect(await screen.findByText('That isn’t your current password.')).toBeInTheDocument();
    expect(useSession.getState().status).toBe('signedIn');
  });

  it('closes the account, logs out here and says when it goes for good', async () => {
    serve({
      'DELETE /me': (init) => {
        expect(JSON.parse(String(init?.body))).toEqual({ password: 'correct horse battery' });
        return jsonResponse(200, { removeAt: '2026-12-20T10:00:00Z' });
      },
      'POST /auth/logout': () => new Response(null, { status: 204 }),
    });
    renderApp('/me/delete');

    await userEvent.type(await screen.findByLabelText('Your password'), 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }));

    expect(await screen.findByRole('heading', { name: 'Your account is closed' })).toBeInTheDocument();
    expect(screen.getByText(/deleted for good on 20 December 2026/)).toBeInTheDocument();
    expect(useSession.getState().status).toBe('signedOut');
    expect(screen.getByRole('link', { name: 'Log in to keep my account' })).toHaveAttribute('href', '/login');
  });

  it('writes the day in full', () => {
    expect(longDate('2026-12-20T10:00:00Z')).toBe('20 December 2026');
    expect(longDate('not a date')).toBe('');
  });
});

describe('Logging in during the 30 days', () => {
  it('says the account is no longer being deleted, until closed', async () => {
    render(<RestoredNotice />);
    expect(screen.queryByText(/no longer being deleted/)).not.toBeInTheDocument();

    setSignedIn({ accessToken: 't2', expiresIn: 900, user: testUser, restored: true });

    expect(
      await screen.findByText('Welcome back. Your account is no longer being deleted.'),
    ).toBeInTheDocument();
    // A later refresh doesn't hide it.
    setSignedIn({ accessToken: 't3', expiresIn: 900, user: testUser });
    expect(screen.getByText(/no longer being deleted/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByText(/no longer being deleted/)).not.toBeInTheDocument());
  });
});

describe('Terms and Privacy Policy', () => {
  it('is open to everyone, as sign-up links to it', async () => {
    useSession.setState({ status: 'signedOut', user: null, guest: null, accessToken: null });
    serve({});
    renderApp('/privacy');

    expect(await screen.findByRole('heading', { name: 'Terms and Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your location' })).toBeInTheDocument();
    expect(screen.getByText(/Trip chat: deleted 7 days after the trip ends/)).toBeInTheDocument();
  });
});
