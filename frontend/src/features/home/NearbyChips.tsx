import { Link } from 'react-router';
import { Bell } from 'lucide-react';
import type { NearbyCategory } from '../newTrip/placesApi';
import { CATEGORY_LABELS } from './nearbyCategories';

const chip =
  'flex h-11 flex-none items-center gap-2 rounded-pill px-4 text-[15px] font-bold whitespace-nowrap';
// The glass style sets its own background, so the active chip leaves it out to show solid blue.
const chipIdle = `${chip} glass-strong text-ink`;
const chipActive = `${chip} bg-blue text-on-primary shadow-primary`;

/**
 * Shortcuts under the search bar: show cafes, stays or sights near where the map is, and the alerts inbox.
 * The place chips are toggles; pressing the active one again clears the map.
 */
export function NearbyChips({
  active,
  onChange,
}: {
  active: NearbyCategory | null;
  onChange: (category: NearbyCategory | null) => void;
}) {
  return (
    <div role="group" aria-label="Show nearby" className="flex gap-2 overflow-x-auto px-3 pb-1">
      {(Object.keys(CATEGORY_LABELS) as NearbyCategory[]).map((category) => {
        const { label, Icon, tone } = CATEGORY_LABELS[category];
        const pressed = active === category;
        return (
          <button
            key={category}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(pressed ? null : category)}
            className={pressed ? chipActive : chipIdle}
          >
            <Icon aria-hidden="true" className={`size-5 ${pressed ? '' : tone}`} />
            {label}
          </button>
        );
      })}
      <Link to="/me/alerts" className={chipIdle}>
        <Bell aria-hidden="true" className="size-5 text-amber" />
        Alerts
      </Link>
    </div>
  );
}
