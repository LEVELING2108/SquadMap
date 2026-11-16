import { BedDouble, Coffee, Landmark, type LucideIcon } from 'lucide-react';
import type { NearbyCategory } from '../newTrip/placesApi';

/** How each Home chip reads and looks. */
export const CATEGORY_LABELS: Record<NearbyCategory, { label: string; Icon: LucideIcon; tone: string }> = {
  cafes: { label: 'Cafes', Icon: Coffee, tone: 'text-coral-d' },
  stays: { label: 'Stays', Icon: BedDouble, tone: 'text-friend-2' },
  sights: { label: 'Sights', Icon: Landmark, tone: 'text-sea-d' },
};
