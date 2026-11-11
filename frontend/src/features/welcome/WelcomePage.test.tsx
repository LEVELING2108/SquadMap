import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../../AppRoutes';

function renderWelcome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('Welcome screen', () => {
  it('leads with the product promise', () => {
    renderWelcome();

    expect(screen.getByRole('heading', { level: 1, name: 'Get there together' })).toBeInTheDocument();
    expect(screen.getByText(/See every friend on one live map/)).toBeInTheDocument();
  });

  it('lists the three features', () => {
    renderWelcome();

    const features = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(features.map((item) => item.textContent)).toEqual(['Live map', 'Shared ETAs', 'Join by link']);
  });

  it.each([
    ['Get started', '/signup'],
    ['I have an invite link', '/join'],
    ['Log in', '/login'],
    ['Skip', '/home'],
  ])('"%s" goes to %s', (name, href) => {
    renderWelcome();

    expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
  });

  it('keeps the decorative illustration away from screen readers', () => {
    const { container } = renderWelcome();

    // The friend tags are part of the scene, not content.
    expect(screen.getByText(/Priya · 4 min/).closest('[aria-hidden="true"]')).not.toBeNull();
    for (const image of container.querySelectorAll('img')) {
      expect(image.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(image).toHaveAttribute('alt', '');
    }
  });
});
