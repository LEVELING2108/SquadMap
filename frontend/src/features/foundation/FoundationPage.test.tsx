import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../../AppRoutes';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('app shell', () => {
  it('shows the foundation page at the root', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { level: 1, name: 'SquadMap' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Primary action' })).toBeInTheDocument();
  });

  it('starts on the system theme and switches when a theme is picked', async () => {
    const user = userEvent.setup();
    renderAt('/');

    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Dark' }));

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('shows a not-found page with a way home for unknown paths', () => {
    renderAt('/no-such-page');

    expect(screen.getByRole('heading', { name: 'This page does not exist' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to home' })).toHaveAttribute('href', '/');
  });
});
