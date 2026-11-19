import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallRow } from './InstallRow';
import { listenForInstall, useInstall } from './installPrompt';
import { OfflineBar } from './OfflineBar';
import { UpdateToast } from './UpdateToast';

const sw = vi.hoisted(() => ({
  needRefresh: false,
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn(),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [sw.needRefresh, sw.setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: sw.updateServiceWorker,
  }),
}));

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  });
}

afterEach(() => {
  setOnline(true);
  sw.needRefresh = false;
  vi.clearAllMocks();
});

describe('A new version', () => {
  it('says nothing until a new version is ready', () => {
    render(<UpdateToast />);

    expect(screen.queryByText('A new version is ready')).not.toBeInTheDocument();
  });

  it('offers to reload into it, or to wait', async () => {
    sw.needRefresh = true;
    render(<UpdateToast />);

    expect(screen.getByRole('status')).toHaveTextContent('A new version is ready');
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true);

    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(sw.setNeedRefresh).toHaveBeenCalledWith(false);
  });
});

describe('Offline', () => {
  const at = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <OfflineBar />
      </MemoryRouter>,
    );

  it('says so while the phone has no connection, and goes away when it is back', () => {
    at('/home');
    expect(screen.queryByText(/You’re offline/)).not.toBeInTheDocument();

    setOnline(false);
    expect(screen.getByRole('status')).toHaveTextContent(/^You’re offline$/);

    setOnline(true);
    expect(screen.queryByText(/You’re offline/)).not.toBeInTheDocument();
  });

  it.each(['/trip/t1', '/trip/t1/eta', '/trip/t1/chat', '/trip/t1/menu', '/trip/t1/friend/m1'])(
    'leaves the live map at %s to its own offline banner',
    (path) => {
      setOnline(false);
      at(path);
      expect(screen.queryByText(/You’re offline/)).not.toBeInTheDocument();
    },
  );

  it.each(['/trip/new', '/trip/t1/invite', '/me'])('shows on other screens such as %s', (path) => {
    setOnline(false);
    at(path);
    expect(screen.getByText(/You’re offline/)).toBeInTheDocument();
  });
});

describe('Install SquadMap', () => {
  const userAgent = navigator.userAgent;

  beforeEach(() => {
    useInstall.setState({ offer: null, installed: false });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
  });

  const row = () =>
    render(
      <ul>
        <InstallRow />
      </ul>,
    );

  it('is offered when the browser can install the app, and opens its install dialog', async () => {
    listenForInstall();
    const prompt = vi.fn().mockResolvedValue(undefined);
    const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    act(() => {
      window.dispatchEvent(offer);
    });
    expect(offer.defaultPrevented).toBe(true);
    row();

    await userEvent.click(screen.getByRole('button', { name: /Install SquadMap/ }));

    expect(prompt).toHaveBeenCalled();
    expect(screen.queryByText('Install SquadMap')).not.toBeInTheDocument();
  });

  it('explains the Share menu on iPhone, where there is no install dialog', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
      configurable: true,
    });
    row();

    expect(screen.getByText('In Safari, tap Share, then Add to Home Screen')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Install SquadMap/ })).not.toBeInTheDocument();
  });

  it('is gone once the app is installed, and where it can’t be', () => {
    useInstall.setState({ installed: true });
    const { unmount } = row();
    expect(screen.queryByText('Install SquadMap')).not.toBeInTheDocument();
    unmount();

    useInstall.setState({ installed: false });
    row();
    expect(screen.queryByText('Install SquadMap')).not.toBeInTheDocument();
  });
});
