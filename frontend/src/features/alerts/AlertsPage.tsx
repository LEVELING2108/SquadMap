import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Bell, Check, Clock } from 'lucide-react';
import { BackButton } from '../../components/ui/BackButton';
import { Banner } from '../../components/ui/Banner';
import { BOTTOM_NAV_SPACE, BottomNav } from '../../components/ui/BottomNav';
import { Button } from '../../components/ui/Button';
import { describeFailure } from '../auth/formErrors';
import { timeAgo } from '../invite/timeAgo';
import { alertLink, alertTitle, isToday, useAlerts, useMarkRead, type Alert } from './alertsApi';
import { PushAlerts } from './PushAlerts';

function capitalised(text: string | null): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

/** The round picture at the start of a row: the friend's initial, or an icon for the trip's news. */
function Badge({ alert }: { alert: Alert }) {
  if (alert.kind === 'member_joined' || alert.kind === 'member_left') {
    return (
      <span
        aria-hidden="true"
        className="flex size-11 flex-none items-center justify-center rounded-pill text-lg font-extrabold text-on-person"
        style={{ backgroundColor: alert.actorColor ?? undefined }}
      >
        {(alert.actorName ?? '?').charAt(0).toUpperCase()}
      </span>
    );
  }
  const ending = alert.kind === 'ending_soon';
  const Icon = ending ? Clock : Check;
  return (
    <span
      aria-hidden="true"
      className={`flex size-11 flex-none items-center justify-center rounded-control ${
        ending ? 'bg-amber-bg text-amber' : 'bg-green-bg text-green'
      }`}
    >
      <Icon className="size-5" />
    </span>
  );
}

function AlertRow({ alert, onOpen }: { alert: Alert; onOpen: (alert: Alert) => void }) {
  const when = capitalised(timeAgo(alert.createdAt));
  const detail =
    alert.kind === 'ending_soon' && alert.tripLive
      ? `${alert.tripName} · Extend or end the trip`
      : alert.kind === 'trip_ended'
        ? when
        : `${alert.tripName} · ${when}`;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(alert)}
        className="flex min-h-[68px] w-full items-center gap-3.5 px-4 py-3 text-left"
      >
        <Badge alert={alert} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base leading-[22px] font-bold">{alertTitle(alert)}</span>
          <span className="block truncate text-[13px] leading-[18px] text-muted">{detail}</span>
        </span>
        {!alert.read && (
          <>
            <span aria-hidden="true" className="size-2.5 flex-none rounded-pill bg-blue" />
            <span className="sr-only">Unread</span>
          </>
        )}
      </button>
    </li>
  );
}

function Group({
  title,
  alerts,
  onOpen,
}: {
  title: string;
  alerts: Alert[];
  onOpen: (alert: Alert) => void;
}) {
  if (alerts.length === 0) return null;
  const id = `alerts-${title.toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="px-2 text-xs leading-4 font-bold tracking-[1.5px] text-muted uppercase">
        {title}
      </h2>
      <ul className="glass-strong m-0 list-none divide-y divide-line overflow-hidden rounded-card p-0">
        {alerts.map((alert) => (
          <AlertRow key={alert.id} alert={alert} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  );
}

/** What happened on your trips: who joined or left, sharing about to end, and trips that ended. */
export function AlertsPage() {
  const navigate = useNavigate();
  const list = useAlerts();
  const markRead = useMarkRead();
  const alerts = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const unread = list.data?.pages[0]?.unread ?? 0;
  const { hash } = useLocation();

  // Settings links straight to the push switches.
  useEffect(() => {
    if (hash === '#push') document.getElementById('push')?.scrollIntoView({ block: 'start' });
  }, [hash]);

  function open(alert: Alert) {
    if (!alert.read) markRead.mutate(alert.id);
    navigate(alertLink(alert));
  }

  return (
    <main
      className={`mx-auto flex min-h-dvh w-full max-w-[600px] flex-col gap-4 bg-sand px-3 pt-3 ${BOTTOM_NAV_SPACE}`}
    >
      <header className="flex items-center gap-2">
        <BackButton fallback="/home" className="bg-transparent shadow-none" />
        <h1 className="flex-1 text-[22px] leading-7 font-heading tracking-[-0.3px]">Alerts</h1>
        {unread > 0 && (
          <button
            type="button"
            onClick={() => markRead.mutate('all')}
            disabled={markRead.isPending}
            className="h-11 rounded-pill px-3 text-[15px] font-bold text-ink"
          >
            Mark all read
          </button>
        )}
      </header>

      <p role="status" className="sr-only">
        {list.isSuccess ? `${unread} unread` : ''}
      </p>

      {list.isPending && <p className="px-2 text-sm leading-5 text-muted">Loading your alerts…</p>}
      {list.isError && <Banner tone="error">{describeFailure(list.error)}</Banner>}

      {list.isSuccess && alerts.length === 0 && (
        <section className="glass-strong flex flex-col items-start gap-2 rounded-card p-5">
          <Bell aria-hidden="true" className="size-7 text-blue-d" />
          <h2 className="text-base leading-[22px] font-bold">No alerts yet</h2>
          <p className="text-sm leading-5 text-muted">
            You’ll hear here when friends join or leave your trips, when sharing is about to end, and when a
            trip is over.
          </p>
        </section>
      )}

      <Group title="Today" alerts={alerts.filter((alert) => isToday(alert.createdAt))} onOpen={open} />
      <Group title="Earlier" alerts={alerts.filter((alert) => !isToday(alert.createdAt))} onOpen={open} />

      {list.hasNextPage && (
        <Button variant="glass" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
          {list.isFetchingNextPage ? 'Loading…' : 'Show older alerts'}
        </Button>
      )}

      <PushAlerts />

      <BottomNav />
    </main>
  );
}
