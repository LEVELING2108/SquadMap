import { Illustration } from '../../components/ui/Illustration';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Bell,
  ChevronRight,
  Clock,
  KeyRound,
  Mail,
  Pencil,
  Settings as SettingsIcon,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { BackButton } from '../../components/ui/BackButton';
import { BOTTOM_NAV_SPACE, BottomNav } from '../../components/ui/BottomNav';
import { useUnreadAlerts } from '../alerts/alertsApi';
import { signOut, useSession } from '../auth/session';
import { InstallRow } from '../../pwa/InstallRow';
import { LogOutOthers } from './LogOutOthers';
import { useStats } from './settingsApi';

/** "Nov 2026": the month an account was made. */
function sinceLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en', { month: 'short', year: 'numeric' });
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="glass-strong flex min-w-0 flex-1 flex-col rounded-card px-4 py-3">
      <dd className="order-1 m-0 text-[22px] leading-7 font-extrabold">{value}</dd>
      <dt className="order-2 text-[13px] leading-[18px] font-bold text-muted">{label}</dt>
    </div>
  );
}

type RowProps = { to: string; label: string; Icon: LucideIcon; tile: string; count?: number };

function Row({ to, label, Icon, tile, count = 0 }: RowProps) {
  return (
    <li>
      <Link
        to={to}
        aria-label={count > 0 ? `${label}, ${count} unread` : undefined}
        className="flex min-h-[64px] items-center gap-3.5 px-4 py-2.5"
      >
        <span
          aria-hidden="true"
          className={`flex size-10 flex-none items-center justify-center rounded-control ${tile}`}
        >
          <Icon className="size-5" />
        </span>
        <span className="flex-1 text-base leading-[22px] font-bold">{label}</span>
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="flex h-6 min-w-6 items-center justify-center rounded-pill bg-red px-1.5 text-xs font-extrabold text-on-primary"
          >
            {count > 9 ? '9+' : count}
          </span>
        ) : (
          <ChevronRight aria-hidden="true" className="size-5 text-muted" />
        )}
      </Link>
    </li>
  );
}

/** Who you are on SquadMap, your numbers, and the way to your history and settings. */
export function ProfilePage() {
  const navigate = useNavigate();
  const user = useSession((state) => state.user);
  const stats = useStats();
  const unreadAlerts = useUnreadAlerts();

  if (!user) return null;

  const number = (value: number | undefined) =>
    value === undefined ? <span aria-label="Loading">…</span> : value.toLocaleString('en');

  return (
    <main
      className={`relative mx-auto flex min-h-dvh w-full max-w-[600px] flex-col bg-sand ${BOTTOM_NAV_SPACE}`}
    >
      <div className="relative h-[300px] flex-none overflow-hidden">
        <Illustration
          name="hero"
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover object-top"
        />
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
          <BackButton fallback="/home" />
          <Link
            to="/me/settings"
            aria-label="Settings"
            className="glass flex size-11 items-center justify-center rounded-pill text-ink"
          >
            <SettingsIcon aria-hidden="true" className="size-5" />
          </Link>
        </div>
        <div className="relative flex h-full flex-col items-center justify-end pb-6">
          <span
            aria-hidden="true"
            className="flex size-24 items-center justify-center rounded-pill border-4 border-screen text-[40px] font-extrabold text-on-person shadow-lg"
            style={{ backgroundColor: user.color }}
          >
            {user.name.charAt(0).toUpperCase()}
          </span>
          <h1 className="mt-2 max-w-[90%] truncate text-[26px] leading-8 font-heading">{user.name}</h1>
          <p className="text-sm leading-5 font-semibold text-ink/80">
            Explorer since {sinceLabel(user.createdAt)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-3 pt-4">
        <dl aria-label="Your numbers" aria-busy={stats.isPending} className="m-0 flex gap-3">
          <Stat value={number(stats.data?.trips)} label="Trips" />
          <Stat value={number(stats.data?.friends)} label="Friends" />
        </dl>

        <nav aria-label="Your account">
          <ul className="glass-strong m-0 list-none divide-y divide-line overflow-hidden rounded-card p-0">
            <Row to="/me/history" label="Trip history" Icon={Clock} tile="bg-tint text-blue-d" />
            <Row
              to="/me/alerts"
              label="Alerts"
              Icon={Bell}
              tile="bg-amber-bg text-amber"
              count={unreadAlerts}
            />
            <Row to="/me/privacy" label="Privacy and data" Icon={ShieldCheck} tile="bg-sea-bg text-sea-d" />
            <Row to="/me/settings" label="Settings" Icon={SettingsIcon} tile="bg-track text-ink" />
            <InstallRow />
          </ul>
        </nav>

        <nav aria-label="Account">
          <h2 className="mb-2 px-2 text-xs leading-4 font-bold tracking-[1.5px] text-muted">ACCOUNT</h2>
          <ul className="glass-strong m-0 list-none divide-y divide-line overflow-hidden rounded-card p-0">
            <Row to="/me/edit" label="Edit name and colour" Icon={Pencil} tile="bg-sea-bg text-sea-d" />
            <Row to="/me/password" label="Change password" Icon={KeyRound} tile="bg-amber-bg text-amber" />
            <Row to="/me/email" label="Change email" Icon={Mail} tile="bg-tint text-blue-d" />
            <LogOutOthers />
          </ul>
        </nav>

        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate('/', { replace: true });
          }}
          className="h-13 rounded-card bg-red-bg text-[15px] font-bold text-red"
        >
          Log out
        </button>
      </div>

      <BottomNav />
    </main>
  );
}
