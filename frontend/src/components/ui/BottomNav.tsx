import { Bell, Clock, Map, User, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import { useUnreadAlerts } from '../../features/alerts/alertsApi';

/** `end`: only this exact address counts as the tab, not the pages under it. */
type Tab = { to: string; label: string; Icon: LucideIcon; end?: boolean; badge?: boolean };

/** Only screens that exist are listed; a tab is added when its screen is built. */
const tabs: Tab[] = [
  { to: '/home', label: 'Explore', Icon: Map },
  { to: '/me/history', label: 'Trips', Icon: Clock },
  { to: '/me/alerts', label: 'Alerts', Icon: Bell, badge: true },
  { to: '/me', label: 'You', Icon: User, end: true },
];

/** Space a page must leave free at its bottom so the navigation never covers content. */
export const BOTTOM_NAV_SPACE = 'pb-[calc(96px+env(safe-area-inset-bottom))]';

/** "9+" past nine, so the badge stays small. */
function badgeText(count: number): string {
  return count > 9 ? '9+' : String(count);
}

/** The app's main sections, fixed to the bottom of the screen. Alerts shows how many are unread. */
export function BottomNav() {
  const unread = useUnreadAlerts();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[600px] px-3 pb-[max(12px,env(safe-area-inset-bottom))]"
    >
      <ul className="glass-strong m-0 flex list-none gap-1 rounded-pill p-1.5">
        {tabs.map(({ to, label, Icon, end, badge }) => {
          const count = badge ? unread : 0;
          return (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                aria-label={count > 0 ? `${label}, ${count} unread` : undefined}
                className={({ isActive }) =>
                  `relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-pill text-xs leading-4 font-bold ${
                    isActive ? 'bg-tint text-blue-d' : 'text-muted'
                  }`
                }
              >
                <Icon aria-hidden="true" className="size-6" />
                {label}
                {count > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 left-[calc(50%+4px)] flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-red px-1 text-[11px] leading-none font-extrabold text-on-primary"
                  >
                    {badgeText(count)}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
