import { Link } from 'react-router';
import { ChevronLeft, MoreVertical } from 'lucide-react';

type LiveTopBarProps = {
  code: string;
  /** "Live · 3 h left", "Ended", or "Connecting…". */
  status: string;
  live: boolean;
  /** Where the back arrow goes, or null for none (a guest on the map has no Home to go to). */
  back: { to: string; label: string } | null;
  /** Where the menu button goes: the trip menu, or null when there is none (a trip that has ended). */
  menuHref: string | null;
  /** Shown in place of the code and status, as on the chat: "Trip chat", "4 friends". */
  heading?: { title: string; caption: string };
};

/** The floating bar from the design: back, the trip code with its status, and the trip menu. */
export function LiveTopBar({ code, status, live, back, menuHref, heading }: LiveTopBarProps) {
  return (
    <div className="absolute inset-x-0 top-0 z-20 px-3 pt-3">
      <div className="glass-strong flex h-16 items-center gap-1 rounded-pill px-1">
        {back ? (
          <Link
            to={back.to}
            aria-label={back.label}
            className="flex size-12 flex-none items-center justify-center rounded-pill text-ink"
          >
            <ChevronLeft aria-hidden="true" className="size-6" />
          </Link>
        ) : (
          <span className="size-12 flex-none" />
        )}
        {heading ? (
          <div className="flex min-w-0 flex-1 flex-col items-center">
            <p className="truncate text-[17px] leading-6 font-extrabold text-ink">{heading.title}</p>
            <p className="text-[13px] leading-[18px] text-muted">{heading.caption}</p>
          </div>
        ) : (
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
        )}
        {menuHref ? (
          <Link
            to={menuHref}
            aria-label="Trip menu"
            className="flex size-12 flex-none items-center justify-center rounded-pill text-ink"
          >
            <MoreVertical aria-hidden="true" className="size-6" />
          </Link>
        ) : (
          <span className="size-12 flex-none" />
        )}
      </div>
    </div>
  );
}
