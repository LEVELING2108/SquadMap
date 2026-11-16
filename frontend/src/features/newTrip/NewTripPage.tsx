import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { MapPin } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import { ApiError } from '../../lib/api/ApiError';
import { DEFAULT_VIEW } from '../../lib/map/geo';
import { MapView } from '../../lib/map/MapView';
import { BackButton } from '../../components/ui/BackButton';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/Segmented';
import { Switch } from '../../components/ui/Switch';
import { TextField } from '../../components/ui/TextField';
import { describeFailure, focusFirstInvalid } from '../auth/formErrors';
import { tripKeys } from '../trip/tripQueries';
import type { Trip } from '../trip/types';
import { resetTripDraft, SHARE_HOURS, suggestedName, useTripDraft } from './tripDraft';

const MAX_NAME_LENGTH = 60;

/** Setting up the trip: its name, destination, how long to share, and whether friends can chat. */
export function NewTripPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const draft = useTripDraft();
  const destination = draft.destination ?? null;
  const name = draft.name ?? suggestedName(destination);
  const [nameMissing, setNameMissing] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      api<Trip>('/trips', {
        method: 'POST',
        headers: { 'Idempotency-Key': draft.idempotencyKey },
        body: {
          name: name.trim(),
          shareHours: draft.shareHours,
          chatEnabled: draft.chatEnabled,
          destination: destination && {
            name: destination.name,
            lat: destination.lat,
            lng: destination.lng,
            fromSearch: destination.fromSearch,
          },
        },
      }),
    onSuccess: async (trip) => {
      queryClient.setQueryData(tripKeys.one(trip.id), trip);
      await queryClient.invalidateQueries({ queryKey: tripKeys.active() });
      resetTripDraft();
      navigate(`/trip/${trip.id}/invite`, { replace: true });
    },
    onError: () => requestAnimationFrame(() => focusFirstInvalid(formRef.current)),
  });

  const failure = create.error instanceof ApiError ? create.error : null;
  const nameError = nameMissing ? 'Give the trip a name.' : failure?.fieldErrors.name;
  const placeProblem = failure?.code === 'PLACE_NOT_CONFIRMED' || failure?.code === 'PLACES_UNAVAILABLE';

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setNameMissing(true);
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    create.mutate();
  }

  const view = destination ? { center: destination, zoom: 14 } : DEFAULT_VIEW;

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[600px] flex-col overflow-hidden bg-screen">
      <div className="relative h-[330px] flex-none">
        <MapView
          center={{ lat: view.center.lat, lng: view.center.lng }}
          zoom={view.zoom}
          pin={destination !== null}
          label={destination ? `Map showing ${destination.name}` : 'Map'}
          bottomInset={24}
          className="absolute inset-0"
        />
        <BackButton fallback="/home" className="absolute top-3 left-3 z-10" />
      </div>

      <section
        aria-labelledby="new-trip-title"
        className="glass-strong relative z-10 -mt-6 flex flex-1 flex-col gap-4 rounded-t-sheet px-5 pt-3 pb-[max(24px,env(safe-area-inset-bottom))]"
      >
        <div aria-hidden="true" className="mx-auto h-1 w-10 flex-none rounded-[2px] bg-handle" />
        <h1 id="new-trip-title" className="text-[28px] leading-[34px] font-extrabold tracking-[-0.5px]">
          Plan your trip
        </h1>

        <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-4">
          <TextField
            label="Trip name"
            name="name"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(e) => {
              useTripDraft.setState({ name: e.target.value });
              setNameMissing(false);
            }}
            error={nameError}
          />

          <div
            className={`flex min-h-[64px] items-center gap-3 rounded-card px-4 py-3 ${
              placeProblem ? 'bg-red-bg' : 'bg-tint'
            }`}
          >
            <MapPin aria-hidden="true" className="size-6 flex-none text-blue-d" />
            <p className="min-w-0 flex-1">
              <span className="sr-only">Destination: </span>
              <span className="block truncate text-base leading-[22px] font-bold">
                {destination ? destination.name : 'No destination'}
              </span>
              <span className="block truncate text-[13px] leading-[18px] text-muted">
                {destination
                  ? (destination.address ?? 'Pinned on the map')
                  : 'Friends see each other, without a shared end point'}
              </span>
            </p>
            <Link
              to="/trip/new/destination"
              aria-label={destination ? 'Change destination' : 'Add a destination'}
              className="flex h-11 flex-none items-center px-1 text-[15px] font-bold text-blue-d"
            >
              {destination ? 'Change' : 'Add'}
            </Link>
          </div>

          <Segmented
            label="Share my location for"
            options={SHARE_HOURS}
            value={draft.shareHours}
            onChange={(shareHours) => useTripDraft.setState({ shareHours })}
            format={(hours) => `${hours} h`}
            describe={(hours) => (hours === 1 ? '1 hour' : `${hours} hours`)}
          />

          <Switch
            label="Friends can chat"
            description="Quick messages on the trip"
            checked={draft.chatEnabled}
            onChange={(chatEnabled) => useTripDraft.setState({ chatEnabled })}
          />

          {failure && !failure.fieldErrors.name && <Banner tone="error">{describeFailure(failure)}</Banner>}
          {create.isError && !failure && <Banner tone="error">{describeFailure(create.error)}</Banner>}

          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating your trip…' : 'Create trip and invite'}
          </Button>
        </form>
      </section>
    </main>
  );
}
