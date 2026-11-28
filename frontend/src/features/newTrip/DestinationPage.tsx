import { Illustration } from '../../components/ui/Illustration';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { MapPin, X } from 'lucide-react';
import { ApiError } from '../../lib/api/ApiError';
import { BackButton } from '../../components/ui/BackButton';
import { useDebounced } from '../../lib/useDebounced';
import { describeFailure } from '../auth/formErrors';
import { PlaceRow } from './PlaceRow';
import { usePlaceSearch, useRecentPlaces } from './placesApi';
import { setDraftDestination } from './tripDraft';
import type { PlaceResult } from './types';
import { useKnownLocation } from './useKnownLocation';

/** Searching waits for typing to pause, so each word doesn't cost a request. */
const SEARCH_DELAY_MS = 250;

const pillClasses =
  'glass-strong flex min-h-11 items-center justify-center gap-2 rounded-pill px-3 py-2 text-center text-[15px] leading-tight font-bold text-ink';

/** Picking where the trip is heading: search, a recent place, a pin on the map, or nowhere in particular. */
export function DestinationPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const query = useDebounced(text.trim(), SEARCH_DELAY_MS);
  const here = useKnownLocation();
  const search = usePlaceSearch(query, here);
  const recent = useRecentPlaces();
  const searching = query.length >= 2;

  function pick(place: PlaceResult) {
    setDraftDestination({
      name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      // Recent places come from our own trips and are already confirmed.
      fromSearch: place.kind !== 'recent',
    });
    navigate('/trip/new');
  }

  function skip() {
    setDraftDestination(null);
    navigate('/trip/new');
  }

  const unavailable = search.error instanceof ApiError && search.error.code === 'PLACES_UNAVAILABLE';
  let status = '';
  if (searching && search.isFetching) status = 'Searching…';
  else if (searching && search.data) {
    status =
      search.data.length === 0
        ? 'No places match. Try another name, or choose on the map.'
        : `${search.data.length} ${search.data.length === 1 ? 'place' : 'places'} found`;
  }

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[600px] flex-col overflow-hidden bg-screen">
      <div aria-hidden="true" className="absolute inset-0">
        <Illustration name="map" className="size-full scale-105 object-cover blur-[3px] saturate-[1.2]" />
      </div>

      <div className="relative flex flex-1 flex-col gap-4 px-3 pt-3 pb-24">
        <h1 className="sr-only">Where to?</h1>
        <form
          role="search"
          onSubmit={(event) => event.preventDefault()}
          className="glass-strong flex h-14 items-center gap-1 rounded-pill pr-1.5 pl-1.5"
        >
          <BackButton fallback="/home" className="bg-transparent shadow-none" />
          <input
            ref={inputRef}
            type="search"
            aria-label="Search for a place"
            placeholder="Where to?"
            autoComplete="off"
            enterKeyHint="search"
            maxLength={100}
            // The screen exists to type a place; focusing it saves a tap.
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="h-11 min-w-0 flex-1 bg-transparent px-2 text-base font-bold text-ink placeholder:font-semibold placeholder:text-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {text && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setText('');
                inputRef.current?.focus();
              }}
              className="flex size-11 flex-none items-center justify-center rounded-pill text-ink"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          )}
        </form>

        <p
          role="status"
          className={status ? 'px-2 text-[13px] leading-[18px] font-semibold text-muted' : 'sr-only'}
        >
          {status}
        </p>

        {searching && search.isError && (
          <div
            role="alert"
            className="glass-strong rounded-card px-4 py-3 text-sm leading-5 font-semibold text-red"
          >
            {unavailable
              ? 'Place search isn’t available right now. You can choose the spot on the map instead.'
              : describeFailure(search.error)}
          </div>
        )}

        {searching && search.data && search.data.length > 0 && (
          <ul aria-label="Places found" className="m-0 flex list-none flex-col gap-2 p-0">
            {search.data.map((place, index) => (
              <PlaceRow key={place.id ?? `${place.name}-${index}`} place={place} onPick={pick} />
            ))}
          </ul>
        )}

        {!searching && recent.data && recent.data.length > 0 && (
          <section aria-labelledby="recent-title" className="flex flex-col gap-2">
            <h2
              id="recent-title"
              className="mt-2 px-2 text-xs leading-4 font-bold tracking-[1.5px] text-muted"
            >
              RECENT
            </h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {recent.data.map((place, index) => (
                <PlaceRow key={`${place.name}-${index}`} place={place} onPick={pick} />
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto grid w-full max-w-[600px] grid-cols-2 gap-2 px-3 pb-[max(24px,env(safe-area-inset-bottom))]">
        <Link to="/trip/new/map" className={pillClasses}>
          <MapPin aria-hidden="true" className="size-5 text-blue-d" />
          Choose on map
        </Link>
        <button type="button" onClick={skip} className={pillClasses}>
          Skip, no destination
        </button>
      </div>
    </main>
  );
}
