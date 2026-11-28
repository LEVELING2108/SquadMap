import { useNavigate } from 'react-router';
import { MapPin, X } from 'lucide-react';
import { ApiError } from '../../lib/api/ApiError';
import { Button } from '../../components/ui/Button';
import { formatDistance } from '../../lib/map/geo';
import { describeFailure } from '../auth/formErrors';
import type { NearbyCategory } from '../newTrip/placesApi';
import { setDraftDestination } from '../newTrip/tripDraft';
import type { PlaceResult } from '../newTrip/types';
import { useSettings } from '../profile/settingsApi';
import { CATEGORY_LABELS } from './nearbyCategories';

type NearbyPanelProps = {
  category: NearbyCategory;
  places: PlaceResult[] | undefined;
  loading: boolean;
  error: unknown;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
};

/**
 * The panel while a chip is on: the places found, nearest first, then the chosen one with a way to plan a
 * trip there. Search Box results may not be stored, so "Plan a trip here" starts from a pin the person
 * places and names themselves, on the spot.
 */
export function NearbyPanel({
  category,
  places,
  loading,
  error,
  selectedId,
  onSelect,
  onClose,
}: NearbyPanelProps) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { label } = CATEGORY_LABELS[category];
  const selected = places?.find((place) => (place.id ?? place.name) === selectedId) ?? null;

  function planHere(place: PlaceResult) {
    setDraftDestination({
      name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      fromSearch: false,
    });
    navigate('/trip/new/map');
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h1 id="home-title" className="text-[22px] leading-7 font-heading">
          {label} nearby
        </h1>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${label.toLowerCase()}`}
          className="flex size-11 items-center justify-center rounded-pill text-muted"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      {loading && (
        <p role="status" className="text-sm leading-5 text-muted">
          Looking around…
        </p>
      )}
      {error !== null && error !== undefined && (
        <p role="alert" className="text-sm leading-5 font-semibold text-red">
          {error instanceof ApiError && error.code === 'PLACES_UNAVAILABLE'
            ? 'Can’t look around just now. Try again in a moment.'
            : describeFailure(error)}
        </p>
      )}
      {places && places.length === 0 && (
        <p role="status" className="text-sm leading-5 text-muted">
          No {label.toLowerCase()} found around here. Move the map and try again.
        </p>
      )}

      {selected && (
        <div className="flex flex-col gap-3 rounded-card bg-tint px-4 py-3">
          <div className="flex items-start gap-3">
            <MapPin aria-hidden="true" className="mt-0.5 size-5 flex-none text-blue-d" />
            <div className="min-w-0">
              <p className="text-base leading-[22px] font-bold">{selected.name}</p>
              <p className="text-[13px] leading-[18px] text-muted">
                {[selected.address, formatDistance(selected.distanceMeters, settings.distanceUnit)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          <Button onClick={() => planHere(selected)}>Plan a trip here</Button>
        </div>
      )}

      {places && places.length > 0 && (
        <ul aria-label={`${label} nearby`} className="m-0 flex list-none flex-col p-0">
          {places.map((place) => {
            const id = place.id ?? place.name;
            const isSelected = id === selectedId;
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(isSelected ? null : id)}
                  className="flex min-h-[56px] w-full items-center gap-3 py-2 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-base leading-[22px] ${isSelected ? 'font-extrabold' : 'font-bold'}`}
                    >
                      {place.name}
                    </span>
                    <span className="block truncate text-[13px] leading-[18px] text-muted">
                      {place.address}
                    </span>
                  </span>
                  <span className="flex-none text-[13px] font-bold text-muted">
                    {formatDistance(place.distanceMeters, settings.distanceUnit)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
