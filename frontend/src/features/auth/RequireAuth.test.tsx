import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { RequireAuth } from './RequireAuth';
import { useSession } from './session';

function LoginProbe() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
  return <p>Login page, back to {from}</p>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route
          path="/private"
          element={
            <RequireAuth>
              <p>Private content</p>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useSession.setState({ status: 'unknown', user: null, accessToken: null });
});

describe('RequireAuth', () => {
  it('waits while the session is being restored', () => {
    renderAt('/private');

    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Private content')).not.toBeInTheDocument();
  });

  it('shows the page to a signed-in person', () => {
    useSession.setState({ status: 'signedIn', accessToken: 't', user: null });
    renderAt('/private');

    expect(screen.getByText('Private content')).toBeInTheDocument();
  });

  it('sends a signed-out person to log in and remembers where they were going', () => {
    useSession.setState({ status: 'signedOut' });
    renderAt('/private');

    expect(screen.getByText('Login page, back to /private')).toBeInTheDocument();
  });
});
