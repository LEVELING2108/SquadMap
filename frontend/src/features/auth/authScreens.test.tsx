import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderApp, sampleTrip, testUser } from '../../test/renderApp';
import { useSession } from './session';

const fetchMock = vi.fn<typeof fetch>();
const requestBody = (call: number) => JSON.parse(String(fetchMock.mock.calls[call]![1]!.body));
const requestUrl = (call: number) => String(fetchMock.mock.calls[call]![0]);
const location = () => screen.getByTestId('location').textContent;

beforeEach(() => {
  useSession.setState({ status: 'signedOut', user: null, accessToken: null });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('Log in', () => {
  it('checks the fields before sending anything and focuses the first problem', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email.');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password.');
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveFocus());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs in and goes home', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { accessToken: 't', expiresIn: 900, user: testUser }));
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), ' priya@example.com ');
    await user.type(screen.getByLabelText('Password'), 'correct horse');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(location()).toBe('/home'));
    expect(requestUrl(0)).toBe('/api/v1/auth/login');
    expect(requestBody(0)).toEqual({ email: 'priya@example.com', password: 'correct horse' });
    expect(useSession.getState().status).toBe('signedIn');
  });

  it('returns to the page that asked for a login', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { accessToken: 't', expiresIn: 900, user: testUser }));
    renderApp({ pathname: '/login', state: { from: { pathname: '/trip/42' } } });

    await user.type(screen.getByLabelText('Email'), 'priya@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(location()).toBe('/trip/42'));
  });

  it('shows the server message for a wrong password', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { code: 'INVALID_CREDENTIALS', detail: 'Email or password is incorrect.' }),
    );
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'priya@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(location()).toBe('/login');
  });

  it('says how long to wait when rate limited', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        429,
        { code: 'RATE_LIMITED', detail: 'Too many attempts.', retryAfter: 12 },
        { 'Retry-After': '12' },
      ),
    );
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'priya@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Try again in 12 seconds.');
  });

  it('shows and hides the password', async () => {
    const user = userEvent.setup();
    renderApp('/login');
    const field = screen.getByLabelText('Password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(field).toHaveAttribute('type', 'password');
  });

  it('sends a signed-in person straight home', () => {
    useSession.setState({ status: 'signedIn', user: testUser, accessToken: 't' });
    renderApp('/login');

    expect(location()).toBe('/home');
  });
});

describe('Sign up', () => {
  async function fillIn(user: ReturnType<typeof userEvent.setup>, password = 'a good long passphrase') {
    await user.type(screen.getByLabelText('Name'), 'Priya');
    await user.type(screen.getByLabelText('Email'), 'priya@example.com');
    await user.type(screen.getByLabelText('Password'), password);
  }

  it('requires agreeing to the terms', async () => {
    const user = userEvent.setup();
    renderApp('/signup');
    await fillIn(user);

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByRole('checkbox')).toHaveAccessibleDescription(
      'Agree to the Terms and Privacy Policy to continue.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a short password before sending', async () => {
    const user = userEvent.setup();
    renderApp('/signup');
    await fillIn(user, 'short');
    await user.click(screen.getByRole('checkbox'));

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'Use between 8 and 128 characters.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows password strength in words, not colour alone', async () => {
    const user = userEvent.setup();
    renderApp('/signup');

    await user.type(screen.getByLabelText('Password'), 'abc');
    expect(screen.getByText(/Password strength/).parentElement).toHaveTextContent(
      'Password strength: Too short',
    );
    await user.type(screen.getByLabelText('Password'), 'Kite-7 Rivermoon');
    expect(screen.getByText(/Password strength/).parentElement).toHaveTextContent(
      'Password strength: Strong',
    );
  });

  it('creates the account and goes home', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { accessToken: 't', expiresIn: 900, user: testUser }));
    renderApp('/signup');
    await fillIn(user);
    await user.click(screen.getByRole('checkbox'));

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(location()).toBe('/home'));
    expect(requestBody(0)).toEqual({
      name: 'Priya',
      email: 'priya@example.com',
      password: 'a good long passphrase',
      acceptedTerms: true,
    });
  });

  it('shows "already has an account" on the email field', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        code: 'EMAIL_TAKEN',
        detail: 'This email already has an account. Log in instead.',
      }),
    );
    renderApp('/signup');
    await fillIn(user);
    await user.click(screen.getByRole('checkbox'));

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
        'This email already has an account. Log in instead.',
      ),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Forgot password', () => {
  it('confirms the email was sent', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(202));
    renderApp('/forgot');

    await user.type(screen.getByLabelText('Email'), 'priya@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Sent! Check your inbox.');
    expect(requestBody(0)).toEqual({ email: 'priya@example.com' });
    expect(screen.getByRole('button', { name: 'Send again' })).toBeInTheDocument();
  });

  it('starts with the email typed on the login screen', () => {
    renderApp({ pathname: '/forgot', state: { email: 'priya@example.com' } });

    expect(screen.getByLabelText('Email')).toHaveValue('priya@example.com');
  });
});

describe('Set a new password', () => {
  const token = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';

  it('reads the token from the link and removes it from the address bar', async () => {
    renderApp({ pathname: '/reset-password', hash: `#token=${token}` });

    expect(screen.getByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument();
    await waitFor(() => expect(location()).toBe('/reset-password'));
  });

  it('saves the new password and offers to log in', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(204));
    renderApp({ pathname: '/reset-password', hash: `#token=${token}` });

    await user.type(screen.getByLabelText('New password'), 'a brand new passphrase');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(await screen.findByRole('heading', { name: 'Password changed' })).toBeInTheDocument();
    expect(requestBody(0)).toEqual({ token, password: 'a brand new passphrase' });
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });

  it('explains an expired or used link and offers a new one', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        code: 'RESET_LINK_INVALID',
        detail: 'This reset link has expired or was already used.',
      }),
    );
    renderApp({ pathname: '/reset-password', hash: `#token=${token}` });

    await user.type(screen.getByLabelText('New password'), 'a brand new passphrase');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(await screen.findByRole('heading', { name: 'This link has expired' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot');
  });

  it('treats a link without a token as expired', () => {
    renderApp('/reset-password');

    expect(screen.getByRole('heading', { name: 'This link has expired' })).toBeInTheDocument();
  });
});

describe('Home', () => {
  it('greets a signed-in person and logs them out', async () => {
    const user = userEvent.setup();
    useSession.setState({ status: 'signedIn', user: testUser, accessToken: 't' });
    fetchMock.mockImplementation(async (url) =>
      String(url).startsWith('/api/v1/trips') ? jsonResponse(200, []) : jsonResponse(204),
    );
    renderApp('/home');

    expect(screen.getByRole('heading', { name: 'Hi, Priya' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(location()).toBe('/'));
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain('/api/v1/auth/logout');
    expect(useSession.getState().status).toBe('signedOut');
  });

  it("lists a signed-in person's running trips, each leading to its invite or trip", async () => {
    useSession.setState({ status: 'signedIn', user: testUser, accessToken: 't' });
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, [
        { ...sampleTrip, id: 't1', name: 'Saturday at Phoenix', role: 'host', memberCount: 3 },
        { ...sampleTrip, id: 't2', name: 'Sunday brunch', role: 'member', memberCount: 1 },
      ]),
    );
    renderApp('/home');

    const hosted = await screen.findByRole('link', { name: /Saturday at Phoenix/ });
    expect(hosted).toHaveAttribute('href', '/trip/t1/invite');
    expect(hosted).toHaveTextContent('You host · 3 people');
    expect(screen.getByRole('link', { name: /Sunday brunch/ })).toHaveAttribute('href', '/trip/t2');
  });

  it('invites someone exploring to sign up or log in', () => {
    renderApp('/home');

    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });
});
