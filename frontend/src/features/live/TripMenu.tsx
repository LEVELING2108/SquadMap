import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight, Clock, MapPinOff, Settings, Timer, UserPlus, X, type LucideIcon } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Switch } from '../../components/ui/Switch';

type TripMenuProps = {
  ref?: Ref<HTMLElement>;
  tripId: string;
  name: string;
  code: string;
  /** "3 h left". */
  left: string;
  isHost: boolean;
  /** Settings live on the account, so guests have none. */
  hasSettings: boolean;
  onExtend: () => void;
  onEnd: () => void;
  onLeave: () => void;
  /** Pausing your location, for someone sharing it; absent otherwise. */
  pause?: { paused: boolean; pending: boolean; onChange: (paused: boolean) => void };
};

const row = 'flex min-h-16 w-full items-center gap-3.5 py-2 text-left';

function Tile({ Icon, tone }: { Icon: LucideIcon; tone: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-10 flex-none items-center justify-center rounded-control ${tone}`}
    >
      <Icon className="size-5" />
    </span>
  );
}

function Words({ title, caption }: { title: string; caption?: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-base leading-[22px] font-bold">{title}</span>
      {caption && <span className="text-[13px] leading-[18px] text-muted">{caption}</span>}
    </span>
  );
}

const chevron = <ChevronRight aria-hidden="true" className="size-5 flex-none text-muted" />;

/**
 * The trip menu (D5): a sheet over the dimmed map with the trip's actions. The host can add time and end
 * the trip for everyone; anyone else can leave. Esc, the close button or a tap on the map closes it.
 */
export function TripMenu({
  ref,
  tripId,
  name,
  code,
  left,
  isHost,
  hasSettings,
  pause,
  onExtend,
  onEnd,
  onLeave,
}: TripMenuProps) {
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const mapHref = `/trip/${tripId}`;

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      // A dialog opened from the menu handles its own Esc.
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) navigate(mapHref);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [navigate, mapHref]);

  return (
    <>
      <div aria-hidden="true" onClick={() => navigate(mapHref)} className="absolute inset-0 z-30 bg-scrim" />
      <section
        ref={ref}
        aria-labelledby="trip-menu-title"
        className="motion-sheet glass-strong absolute inset-x-0 bottom-0 z-40 flex max-h-[calc(100dvh-72px)] flex-col gap-1.5 overflow-y-auto rounded-t-sheet px-5 pt-3 pb-[max(24px,env(safe-area-inset-bottom))]"
      >
        <div aria-hidden="true" className="mx-auto mb-1 h-1 w-10 flex-none rounded-[2px] bg-handle" />
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1
              ref={heading}
              id="trip-menu-title"
              tabIndex={-1}
              className="truncate text-[22px] leading-7 font-heading tracking-[-0.3px] outline-none"
            >
              {name}
            </h1>
            <p className="font-mono text-[13px] leading-[18px] tracking-[1px] text-muted">
              <span className="sr-only">Trip code </span>
              {code}
            </p>
          </div>
          <Link
            to={mapHref}
            aria-label="Close the menu"
            className="flex size-11 flex-none items-center justify-center rounded-pill text-ink"
          >
            <X aria-hidden="true" className="size-6" />
          </Link>
        </div>

        <ul className="flex flex-col [&>li+li]:border-t [&>li+li]:border-line">
          <li>
            <Link to={`/trip/${tripId}/invite`} className={row}>
              <Tile Icon={UserPlus} tone="bg-tint text-blue-d" />
              <Words title="Invite friends" />
              {chevron}
            </Link>
          </li>
          <li>
            <Link to={`/trip/${tripId}/eta`} className={row}>
              <Tile Icon={Clock} tone="bg-amber-bg text-amber" />
              <Words title="Who's on the way" />
              {chevron}
            </Link>
          </li>
          <li>
            {isHost ? (
              <button type="button" onClick={onExtend} aria-haspopup="dialog" className={row}>
                <Tile Icon={Timer} tone="bg-sea-bg text-sea-d" />
                <Words title="Extend sharing time" caption={left} />
                {chevron}
              </button>
            ) : (
              <div className={row}>
                <Tile Icon={Timer} tone="bg-sea-bg text-sea-d" />
                <Words title="Sharing time" caption={`${left}. Only the host can add more.`} />
              </div>
            )}
          </li>
          {pause && (
            <li className="flex min-h-16 items-center py-2">
              <Switch
                label="Pause my location"
                description="Friends see your last known spot"
                checked={pause.paused}
                disabled={pause.pending}
                onChange={pause.onChange}
                leading={<Tile Icon={MapPinOff} tone="bg-track text-ink" />}
              />
            </li>
          )}
          {hasSettings && (
            <li>
              <Link to="/me/settings" className={row}>
                <Tile Icon={Settings} tone="bg-track text-ink" />
                <Words title="Settings" />
                {chevron}
              </Link>
            </li>
          )}
        </ul>

        {isHost ? (
          <Button variant="dangerSoft" onClick={onEnd} aria-haspopup="dialog" className="mt-1.5">
            End trip for everyone
          </Button>
        ) : (
          <button
            type="button"
            onClick={onLeave}
            aria-haspopup="dialog"
            className="h-11 w-full rounded-button text-[15px] font-bold text-red"
          >
            Leave trip
          </button>
        )}
      </section>
    </>
  );
}
