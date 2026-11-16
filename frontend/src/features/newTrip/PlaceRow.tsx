import { Building2, Clock, MapPin, Navigation, Plane, type LucideIcon } from 'lucide-react';
import { formatDistance } from '../../lib/map/geo';
import { useSettings } from '../profile/settingsApi';
import type { PlaceResult } from './types';

type Look = { Icon: LucideIcon; tile: string };

const looks: Record<string, Look> = {
  poi: { Icon: MapPin, tile: 'bg-tint text-blue-d' },
  airport: { Icon: Plane, tile: 'bg-amber-bg text-amber' },
  street: { Icon: Navigation, tile: 'bg-amber-bg text-amber' },
  address: { Icon: Navigation, tile: 'bg-amber-bg text-amber' },
  recent: { Icon: Clock, tile: 'bg-track text-ink' },
};
const area: Look = { Icon: Building2, tile: 'bg-sea-bg text-sea-d' };

function lookOf(place: PlaceResult): Look {
  if (/airport/i.test(place.name) && place.kind !== 'recent') return looks.airport!;
  return looks[place.kind] ?? area;
}

/** One place in the destination list: an icon for its kind, its name, and where it is. */
export function PlaceRow({ place, onPick }: { place: PlaceResult; onPick: (place: PlaceResult) => void }) {
  const { Icon, tile } = lookOf(place);
  const { settings } = useSettings();
  const details = [place.address, formatDistance(place.distanceMeters, settings.distanceUnit)]
    .filter(Boolean)
    .join(' · ');
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(place)}
        className="glass flex min-h-[66px] w-full items-center gap-3.5 rounded-card px-4 py-3 text-left"
      >
        <span
          aria-hidden="true"
          className={`flex size-10 flex-none items-center justify-center rounded-control ${tile}`}
        >
          <Icon className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base leading-[22px] font-bold">{place.name}</span>
          {details && <span className="block truncate text-[13px] leading-[18px] text-muted">{details}</span>}
        </span>
      </button>
    </li>
  );
}
