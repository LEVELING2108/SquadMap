import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderApp, testUser } from '../../test/renderApp';
import { useSession } from '../auth/session';
import { applyRememberedPreferences } from './reducedMotion';
import { DEFAULT_SETTINGS } from './settingsApi';

const fetchMock = vi.fn<typeof fetch>();
const PALETTE = ['#0F6E56', '#534AB7', '#993C1D', '#854F0B', '#993556'];

type Route = (init?: RequestInit) => Response;

function serve(routes: Record<string, Route>) {
  fetchMock.mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input).replace('/api/v1', '')}`;
    if (key === 'GET /me/colors') return jsonResponse(200, PALETTE);
    if (key === 'GET /me/stats') return jsonResponse(200, { trips: 1, friends: 1 });
    const answer = routes[key];
    if (!answer) throw new Error(`Unexpected call: ${key}`);
    return answer(init);
  });
}

function sent(method: string, path: string) {
  const call = fetchMock.mock.calls.find(
    ([input, init]) => init?.method === method && String(input) === `/api/v1${path}`,
  );
  return call ? (JSON.parse(String(call[1]!.body ?? 'null')) as unknown) : undefined;
}

beforeEach(() => {
  useSession.setState({ status: 'signedIn', user: testUser, guest: null, accessToken: 't' });
  vi.stubGlobal('fetch', fetchMock);
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
  document.documentElement.removeAttribute('data-reduce-motion');
});

describe('Edit name and colour', () => {
  it('saves a new name and colour and shows them at once', async () => {
    const user = userEvent.setup();
    serve({ 'PATCH /me': () => jsonResponse(200, { ...testUser, name: 'Priya S', color: '#534AB7' }) });
    renderApp('/me/edit');

    await user.clear(screen.getByLabelText('Your name'));
    await user.type(screen.getByLabelText('Your name'), '  Priya S ');
    await user.click(await screen.findByRole('radio', { name: 'Violet' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Saved.');
    expect(sent('PATCH', '/me')).toEqual({ name: 'Priya S', color: '#534AB7' });
    expect(useSession.getState().user).toMatchObject({ name: 'Priya S', color: '#534AB7' });
  });

  it('offers exactly the palette, with the current colour chosen', async () => {
    serve({});
    renderApp('/me/edit');

    const group = await screen.findByRole('group', { name: 'Your colour' });
    await waitFor(() => expect(within(group).getAllByRole('radio')).toHaveLength(5));
    expect(within(group).getByRole('radio', { name: 'Green' })).toBeChecked();
  });

  it('needs a name', async () => {
    const user = userEvent.setup();
    serve({});
    renderApp('/me/edit');

    await user.clear(screen.getByLabelText('Your name'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription('Enter your name.');
    expect(sent('PATCH', '/me')).toBeUndefined();
  });
});

describe('Change password', () => {
  it('changes it and says other devices were logged out', async () => {
    const user = userEvent.setup();
    serve({ 'POST /auth/password': () => new Response(null, { status: 204 }) });
    renderApp('/me/password');

    await user.type(screen.getByLabelText('Current password'), 'correct horse');
    await user.type(screen.getByLabelText('New password'), 'a whole new passphrase');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Your other devices have been logged out.');
    expect(sent('POST', '/auth/password')).toEqual({
      currentPassword: 'correct horse',
      newPassword: 'a whole new passphrase',
    });
    expect(useSession.getState().status).toBe('signedIn');
  });

  it('shows a wrong current password on its field', async () => {
    const user = userEvent.setup();
    serve({
      'POST /auth/password': () =>
        jsonResponse(400, {
          code: 'VALIDATION_FAILED',
          detail: 'One or more fields are invalid.',
          errors: [{ field: 'currentPassword', message: "That isn't your current password." }],
        }),
    });
    renderApp('/me/password');

    await user.type(screen.getByLabelText('Current password'), 'wrong');
    await user.type(screen.getByLabelText('New password'), 'a whole new passphrase');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Current password')).toHaveAccessibleDescription(
        "That isn't your current password.",
      ),
    );
    // Focus moves to the field on the next frame, after the error is shown.
    await waitFor(() => expect(screen.getByLabelText('Current password')).toHaveFocus());
  });

  it('checks both fields before sending', async () => {
    const user = userEvent.setup();
    serve({});
    renderApp('/me/password');

    await user.type(screen.getByLabelText('New password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(screen.getByLabelText('Current password')).toHaveAccessibleDescription(
      'Enter your current password.',
    );
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(
      /Use between 8 and 128 characters/,
    );
    expect(sent('POST', '/auth/password')).toBeUndefined();
  });

  it('explains when too many tries pause it', async () => {
    const user = userEvent.setup();
    serve({
      'POST /auth/password': () =>
        jsonResponse(429, { code: 'RATE_LIMITED', detail: 'Too many tries.', retryAfter: 600 }),
    });
    renderApp('/me/password');

    await user.type(screen.getByLabelText('Current password'), 'guess');
    await user.type(screen.getByLabelText('New password'), 'a whole new passphrase');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Try again in 10 minutes.');
  });
});

describe('Change email', () => {
  it('moves the login to the new email and mentions the note to the old one', async () => {
    const user = userEvent.setup();
    serve({ 'PUT /me/email': () => jsonResponse(200, { ...testUser, email: 'priya.new@example.com' }) });
    renderApp('/me/email');

    expect(screen.getByText(/You log in with priya@example.com/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('New email'), ' priya.new@example.com ');
    await user.type(screen.getByLabelText('Your password'), 'correct horse');
    await user.click(screen.getByRole('button', { name: 'Change email' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Your email is now priya.new@example.com. We’ve sent a note to your old address',
    );
    expect(sent('PUT', '/me/email')).toEqual({ email: 'priya.new@example.com', password: 'correct horse' });
    expect(useSession.getState().user?.email).toBe('priya.new@example.com');
  });

  it('says when another account uses the email', async () => {
    const user = userEvent.setup();
    serve({ 'PUT /me/email': () => jsonResponse(409, { code: 'EMAIL_TAKEN', detail: 'Taken.' }) });
    renderApp('/me/email');

    await user.type(screen.getByLabelText('New email'), 'aman@example.com');
    await user.type(screen.getByLabelText('Your password'), 'correct horse');
    await user.click(screen.getByRole('button', { name: 'Change email' }));

    await waitFor(() =>
      expect(screen.getByLabelText('New email')).toHaveAccessibleDescription(
        'Another account already uses this email.',
      ),
    );
  });
});

describe('Log out everywhere else', () => {
  it('asks first, then ends the other sessions', async () => {
    const user = userEvent.setup();
    serve({ 'POST /auth/logout-others': () => new Response(null, { status: 204 }) });
    renderApp('/me');

    await user.click(screen.getByRole('button', { name: 'Log out everywhere else' }));
    const dialog = screen.getByRole('dialog', { name: 'Log out everywhere else?' });
    expect(sent('POST', '/auth/logout-others')).toBeUndefined();
    await user.click(within(dialog).getByRole('button', { name: 'Log out other devices' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Logged out of every other device.');
    expect(useSession.getState().status).toBe('signedIn');
  });

  it('can be cancelled without sending anything', async () => {
    const user = userEvent.setup();
    serve({});
    renderApp('/me');

    await user.click(screen.getByRole('button', { name: 'Log out everywhere else' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('logout-others'))).toBe(false);
  });

  it('is listed with the other account changes', () => {
    serve({});
    renderApp('/me');

    const account = screen.getByRole('navigation', { name: 'Account' });
    expect(within(account).getByRole('link', { name: 'Edit name and colour' })).toHaveAttribute(
      'href',
      '/me/edit',
    );
    expect(within(account).getByRole('link', { name: 'Change password' })).toHaveAttribute(
      'href',
      '/me/password',
    );
    expect(within(account).getByRole('link', { name: 'Change email' })).toHaveAttribute('href', '/me/email');
  });
});

describe('the new settings', () => {
  it('shows Dark map only for the Streets style', async () => {
    const user = userEvent.setup();
    let saved = { ...DEFAULT_SETTINGS };
    serve({
      'GET /me/settings': () => jsonResponse(200, saved),
      'PATCH /me/settings': (init) => {
        saved = { ...saved, ...(JSON.parse(String(init!.body)) as object) };
        return jsonResponse(200, saved);
      },
    });
    renderApp('/me/settings', { settings: null });
    await screen.findByRole('switch', { name: 'Dark map' });

    await user.click(screen.getByRole('radio', { name: 'Satellite' }));

    expect(screen.queryByRole('switch', { name: 'Dark map' })).not.toBeInTheDocument();
    await waitFor(() => expect(saved.mapStyle).toBe('satellite'));
  });

  it('turns off the app’s animations with Reduce animations', () => {
    renderApp('/me/settings', { settings: { ...DEFAULT_SETTINGS, reduceMotion: true } });

    expect(document.documentElement).toHaveAttribute('data-reduce-motion');
    expect(screen.getByRole('switch', { name: 'Reduce animations' })).toBeChecked();
  });

  it('remembers Reduce animations on this device, so the next visit starts still', () => {
    renderApp('/me/settings', { settings: { ...DEFAULT_SETTINGS, reduceMotion: true } });
    expect(window.localStorage.getItem('squadmap.reduceMotion')).toBe('1');

    document.documentElement.removeAttribute('data-reduce-motion');
    applyRememberedPreferences();

    expect(document.documentElement).toHaveAttribute('data-reduce-motion');
    window.localStorage.clear();
  });

  it('names the time formats by example', () => {
    renderApp('/me/settings', { settings: { ...DEFAULT_SETTINGS, timeFormat: '24h' } });

    expect(screen.getByRole('radio', { name: '24-hour, like 21:30' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '12-hour, like 9:30 PM' })).not.toBeChecked();
  });
});
