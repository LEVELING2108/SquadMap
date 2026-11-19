import { useId, useRef, type KeyboardEvent } from 'react';

type SegmentedProps<T extends string | number> = {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** How each option reads, for example 4 -> "4 h". */
  format: (option: T) => string;
  /** How each option is announced, for example 4 -> "4 hours". */
  describe?: (option: T) => string;
};

/**
 * One choice from a few, shown side by side. Behaves as a radio group: Tab reaches the chosen option,
 * and the arrow keys move between options.
 */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  format,
  describe,
}: SegmentedProps<T>) {
  const id = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function move(event: KeyboardEvent, index: number) {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next]!);
    buttons.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-[13px] font-semibold text-muted">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        className="flex gap-1 rounded-control bg-track p-1"
      >
        {options.map((option, index) => {
          const selected = option === value;
          return (
            <button
              key={String(option)}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={describe?.(option)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option)}
              onKeyDown={(event) => move(event, index)}
              className={`h-11 flex-1 rounded-[calc(var(--r-control)-4px)] text-[15px] font-bold transition-colors duration-(--dur-fast) ${
                selected ? 'bg-screen text-blue-d shadow-sm' : 'text-ink'
              }`}
            >
              {format(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
