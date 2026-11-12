import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderApp, sampleTrip, testUser } from '../../test/renderApp';
import { useSession } from '../auth/session';
import { shareLength, shortPlace } from './tripQueries';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  useSession.setState({ status: 'signedIn', user: testUser, accessToken: 't' });
  vi.stubGlobal('fetch', fetchMock);
  // jsdom has no native dialog; give it just enough to open and close.
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

function renderInvite(trip = sampleTrip) {
  fetchMock.mockResolvedValue(jsonResponse(200, trip));
  return renderApp(`/trip/${trip.id}/invite`);
}

describe('Invite screen', () => {
  it('shows the boarding pass for the trip', async () => {
    renderInvite();

    const pass = await screen.findByRole('region', { name: 'Boarding pass' });
    expect(within(pass).getByText('You')).toBeInTheDocument();
    expect(within(pass).getByText('Phoenix Marketcity')).toBeInTheDocument();
    expect(within(pass).getByText('Saturday at Phoenix · 4 h')).toBeInTheDocument();
    expect(within(pass).getByText('K7QX2P9T')).toHaveAccessibleName('Trip code K 7 Q X 2 P 9 T');
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/trips/trip-1');
  });

  it('says "Anywhere" for a trip without a destination', async () => {
    renderInvite({ ...sampleTrip, destination: null });

    expect(await screen.findByText('Anywhere')).toBeInTheDocument();
  });

  it('copies the invite link and says so', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    renderInvite();

    await user.click(await screen.findByRole('button', { name: 'Copy link' }));

    expect(writeText).toHaveBeenCalledWith('http://localhost:5480/join/K7QX2P9T');
    expect(screen.getByRole('status')).toHaveTextContent('Link copied.');
  });

  it('opens the native share sheet when the browser has one', async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    renderInvite();

    await user.click(await screen.findByRole('button', { name: 'Share invite link' }));

    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://localhost:5480/join/K7QX2P9T', title: 'Saturday at Phoenix' }),
    );
    Reflect.deleteProperty(navigator, 'share');
  });

  it('copies instead when the browser cannot share', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    renderInvite();

    await user.click(await screen.findByRole('button', { name: 'Share invite link' }));

    expect(writeText).toHaveBeenCalled();
  });

  it('shows the QR code in a dialog and gives focus back on close', async () => {
    const user = userEvent.setup();
    renderInvite();
    const qrButton = await screen.findByRole('button', { name: 'QR code' });

    await user.click(qrButton);
    const dialog = await screen.findByRole('dialog', { name: 'Scan to join' });
    await waitFor(() =>
      expect(within(dialog).getByRole('img', { name: /QR code for the invite link/ }).innerHTML).toContain(
        '<svg',
      ),
    );

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(qrButton).toHaveFocus();
  });

  it('leads to the live map and lets you skip', async () => {
    renderInvite();

    expect(await screen.findByRole('link', { name: 'Open live map' })).toHaveAttribute(
      'href',
      '/trip/trip-1',
    );
    expect(screen.getByRole('link', { name: 'Skip for now' })).toHaveAttribute('href', '/home');
  });

  it('explains a trip that cannot be found', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, { code: 'TRIP_NOT_FOUND', detail: "This trip doesn't exist." }),
    );
    renderApp('/trip/missing/invite');

    expect(await screen.findByRole('alert')).toHaveTextContent("This trip doesn't exist.");
  });
});

describe('trip helpers', () => {
  it('describes the sharing length', () => {
    expect(shareLength({ startsAt: '2026-11-12T10:00:00Z', expiresAt: '2026-11-12T14:00:00Z' })).toBe('4 h');
    expect(shareLength({ startsAt: '2026-11-12T10:00:00Z', expiresAt: '2026-11-12T11:30:00Z' })).toBe(
      '90 min',
    );
  });

  it('shortens a place name to its first part', () => {
    expect(shortPlace('Phoenix Marketcity, Viman Nagar, Pune')).toBe('Phoenix Marketcity');
    expect(shortPlace('Home')).toBe('Home');
  });
});
