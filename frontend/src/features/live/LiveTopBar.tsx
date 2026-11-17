import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, Home, LogOut, MoreVertical, Ticket } from 'lucide-react';

type LiveTopBarProps = {
  code: string;
  /** "Live · 3 h left", "Ended", or "Connecting…". */
  status: string;
  live: boolean;
  /** Signed-in people go back to Home; guests have no Home to go to. */
  showBack: boolean;
  isHost: boolean;
  tripId: string;
  /** Members and guests can leave; the host ends the trip instead (coming with the trip menu). */
  onLeave?: () => void;
  leaving: boolean;
};

/** The floating bar from the design: back, the trip code with its status, and a menu. */
export function LiveTopBar({
  code,
  status,
  live,
  showBack,
  isHost,
  tripId,
  onLeave,
  leaving,
}: LiveTopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);

  const item =
    'flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-left text-[15px] font-bold text-ink';

  return (
    <div className="absolute inset-x-0 top-0 z-20 px-3 pt-3">
      <div className="glass-strong flex h-16 items-center gap-1 rounded-pill px-1">
        {showBack ? (
          <Link
            to="/home"
            aria-label="Back to home"
            className="flex size-12 flex-none items-center justify-center rounded-pill text-ink"
          >
            <ChevronLeft aria-hidden="true" className="size-6" />
          </Link>
        ) : (
          <span className="size-12 flex-none" />
        )}
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <p className="font-mono text-[18px] leading-6 tracking-[3px] text-blue-d">
            <span className="sr-only">Trip code </span>
            {code}
          </p>
          <p className="flex items-center gap-1.5 text-[13px] leading-[18px] text-muted">
            <span aria-hidden="true" className={`size-2 rounded-pill ${live ? 'bg-green' : 'bg-muted'}`} />
            {status}
          </p>
        </div>
        <button
          ref={menuButton}
          type="button"
          aria-label="Trip menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex size-12 flex-none items-center justify-center rounded-pill text-ink"
        >
          <MoreVertical aria-hidden="true" className="size-6" />
        </button>
      </div>
      {menuOpen && (
        <nav id={menuId} aria-label="Trip menu" className="glass-strong mt-2 ml-auto w-64 rounded-card p-2">
          {isHost && (
            <Link to={`/trip/${tripId}/invite`} className={item}>
              <Ticket aria-hidden="true" className="size-5 text-blue" />
              Show the invite
            </Link>
          )}
          {showBack && (
            <Link to="/home" className={item}>
              <Home aria-hidden="true" className="size-5 text-muted" />
              Back to home
            </Link>
          )}
          {onLeave && (
            <button type="button" onClick={onLeave} disabled={leaving} className={`${item} text-red`}>
              <LogOut aria-hidden="true" className="size-5" />
              {leaving ? 'Leaving…' : 'Leave trip'}
            </button>
          )}
        </nav>
      )}
    </div>
  );
}
