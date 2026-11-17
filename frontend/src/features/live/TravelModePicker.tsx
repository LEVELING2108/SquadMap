import { Banner } from '../../components/ui/Banner';
import { Segmented } from '../../components/ui/Segmented';
import { describeFailure } from '../auth/formErrors';
import { modeWords } from './liveFormat';
import type { TravelMode } from './liveTypes';

const MODES = ['car', 'bike', 'walk'] as const;
const LABELS: Record<TravelMode, string> = { car: 'Car', bike: 'Bike', walk: 'Walk' };

type TravelModePickerProps = {
  /** What they chose, or null while the app is guessing. */
  chosen: TravelMode | null;
  /** The mode their current ETA uses: their choice, or the guess. */
  current: TravelMode | null;
  onChoose: (mode: TravelMode) => void;
  error: unknown;
};

/**
 * How this person is getting there, so routes and ETAs fit: car, bike (a motorbike or scooter, which takes
 * the same roads as a car) or walking. Until they choose, the app guesses, and says so.
 */
export function TravelModePicker({ chosen, current, onChoose, error }: TravelModePickerProps) {
  const shown = chosen ?? current ?? 'car';
  return (
    <div className="flex flex-col gap-1.5">
      <Segmented
        label="How are you travelling?"
        options={MODES}
        value={shown}
        onChange={onChoose}
        format={(mode) => LABELS[mode]}
        describe={(mode) => (mode === 'bike' ? 'Bike or scooter' : LABELS[mode])}
      />
      {!chosen && current && (
        <p className="text-[13px] leading-[18px] text-muted">
          We guessed {modeWords(current)} from the distance. Tap to change it.
        </p>
      )}
      {error !== null && error !== undefined && <Banner tone="error">{describeFailure(error)}</Banner>}
    </div>
  );
}
