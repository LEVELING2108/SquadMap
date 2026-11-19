import { useState } from 'react';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/Segmented';
import { describeFailure } from '../auth/formErrors';
import type { Trip } from '../trip/types';
import {
  EXTEND_OPTIONS,
  extendLabel,
  extendWords,
  minutesLeftToAdd,
  useExtendTrip,
  type ExtendMinutes,
} from './tripActions';

type ExtendChoiceProps = {
  trip: Trip;
  onExtended: (trip: Trip) => void;
};

/** +30 min, +1 h or +2 h and the button that adds it. Options past the 12-hour limit can't be chosen. */
export function ExtendChoice({ trip, onExtended }: ExtendChoiceProps) {
  const room = minutesLeftToAdd(trip);
  const allowed = EXTEND_OPTIONS.filter((minutes) => minutes <= room);
  const [chosen, setChosen] = useState<ExtendMinutes | undefined>(() =>
    allowed.includes(60) ? 60 : allowed.at(-1),
  );
  const extend = useExtendTrip(trip.id);

  if (chosen === undefined) {
    return (
      <p className="text-sm leading-5 text-muted">
        This trip has reached 12 hours, the longest a trip can share.
      </p>
    );
  }

  return (
    <>
      <Segmented
        label="Add"
        options={EXTEND_OPTIONS}
        value={chosen}
        onChange={setChosen}
        format={extendLabel}
        describe={extendWords}
        isDisabled={(minutes) => minutes > room}
      />
      {allowed.length < EXTEND_OPTIONS.length && (
        <p className="text-[13px] leading-[18px] text-muted">
          A trip can share for 12 hours at most, so this one can add up to {extendWords(room)}.
        </p>
      )}
      {extend.isError && <Banner tone="error">{describeFailure(extend.error)}</Banner>}
      <Button onClick={() => extend.mutate(chosen, { onSuccess: onExtended })} disabled={extend.isPending}>
        {extend.isPending ? 'Extending…' : 'Extend sharing'}
      </Button>
    </>
  );
}
