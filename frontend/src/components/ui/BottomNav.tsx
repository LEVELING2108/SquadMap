import { Clock, Map, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';

type Tab = { to: string; label: string; Icon: LucideIcon };

/** Only screens that exist are listed; a tab is added when its screen is built. */
const tabs: Tab[] = [
  { to: '/home', label: 'Explore', Icon: Map },
  { to: '/me/history', label: 'Trips', Icon: Clock },
];

/** Space a page must leave free at its bottom so the navigation never covers content. */
export const BOTTOM_NAV_SPACE = 'pb-[calc(96px+env(safe-area-inset-bottom))]';

/** The app's main sections, fixed to the bottom of the screen. */
export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[600px] px-3 pb-[max(12px,env(safe-area-inset-bottom))]"
    >
      <ul className="glass-strong m-0 flex list-none gap-1 rounded-pill p-1.5">
        {tabs.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                `flex h-14 flex-col items-center justify-center gap-0.5 rounded-pill text-xs leading-4 font-bold ${
                  isActive ? 'bg-tint text-blue-d' : 'text-muted'
                }`
              }
            >
              <Icon aria-hidden="true" className="size-6" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
