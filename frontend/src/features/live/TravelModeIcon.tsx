import { Car, Footprints, Motorbike } from 'lucide-react';
import type { TravelMode } from './liveTypes';

/** The picture for a travel mode; always shown next to the words, so it is hidden from screen readers. */
export function TravelModeIcon({ mode, className = 'size-4' }: { mode: TravelMode; className?: string }) {
  const Icon = mode === 'car' ? Car : mode === 'bike' ? Motorbike : Footprints;
  return <Icon aria-hidden="true" className={className} />;
}
