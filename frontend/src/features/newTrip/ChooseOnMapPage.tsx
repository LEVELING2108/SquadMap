import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { BackButton } from '../../components/ui/BackButton';
import { Banner } from '../../components/ui/Banner';
import { Button, ButtonLink } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { DEFAULT_VIEW, type LatLng } from '../../lib/map/geo';
import { DestinationPin, MapView } from '../../lib/map/MapView';
import { setDraftDestination, useTripDraft } from './tripDraft';
import { useKnownLocation } from './useKnownLocation';

const SPOT_ZOOM = 15;

/**
 * Dropping a pin: the pin stays in the middle and the map moves under it. Saved as given, so it
 * suits a spot search doesn't know, like "Gate 3" or a friend's building.
 */
export function ChooseOnMapPage() {
  const navigate = useNavigate();
  const draft = useTripDraft((state) => state.destination);
  const here = useKnownLocation();
  const [moved, setMoved] = useState<LatLng | null>(null);
  const [name, setName] = useState(draft && !draft.fromSearch ? draft.name : 'Meeting point');
  const [error, setError] = useState<string>();
  const [real, setReal] = useState<boolean | null>(null);

  // Start at the current destination, else where the person is (if already shared), else India.
  const start = draft ? { center: { lat: draft.lat, lng: draft.lng }, zoom: SPOT_ZOOM } : null;
  const view = start ?? (here ? { center: here, zoom: SPOT_ZOOM } : DEFAULT_VIEW);
  const center = moved ?? view.center;

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give this spot a name friends will recognise.');
      return;
    }
    setDraftDestination({
      name: trimmed,
      address: null,
      lat: center.lat,
      lng: center.lng,
      fromSearch: false,
    });
    navigate('/trip/new');
  }

  return (
    <main className="relative mx-auto flex h-dvh w-full max-w-[600px] flex-col overflow-hidden bg-screen">
      <h1 className="sr-only">Choose the spot on the map</h1>
      <div className="relative flex-1">
        <MapView
          center={moved ?? view.center}
          zoom={view.zoom}
          interactive
          label="Map. Move it until the pin is on the meeting spot."
          onCenterChange={setMoved}
          onReady={setReal}
          bottomInset={24}
          className="absolute inset-0"
        />
        {real !== false && (
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
            <DestinationPin />
          </div>
        )}
        <BackButton fallback="/trip/new/destination" className="absolute top-3 left-3 z-10" />
      </div>

      <section
        aria-label="Name the spot"
        className="glass-strong relative z-10 -mt-6 flex flex-col gap-3 rounded-t-sheet px-5 pt-5 pb-[max(24px,env(safe-area-inset-bottom))]"
      >
        {real === false ? (
          <>
            <Banner tone="error">
              The map couldn’t load here, so a spot can’t be picked on it. Search for the place instead.
            </Banner>
            <ButtonLink to="/trip/new/destination" replace>
              Search for a place
            </ButtonLink>
          </>
        ) : (
          <form noValidate onSubmit={submit} className="flex flex-col gap-3">
            <p className="text-sm leading-5 text-muted">Move the map so the pin sits on the meeting spot.</p>
            <TextField
              label="Name this spot"
              name="spotName"
              maxLength={120}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(undefined);
              }}
              error={error}
            />
            <Button type="submit">Use this spot</Button>
          </form>
        )}
      </section>
    </main>
  );
}
