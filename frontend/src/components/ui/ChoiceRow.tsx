import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { ChoiceSheet, type Choice } from './ChoiceSheet';

type ChoiceRowProps<T extends string | number> = {
  label: string;
  choices: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * One setting on one line, "Map style · Outdoors ›". Tapping it opens a sheet to pick another option
 * (ChoiceSheet). Use inside a settings card.
 */
export function ChoiceRow<T extends string | number>({ label, choices, value, onChange }: ChoiceRowProps<T>) {
  const [open, setOpen] = useState(false);
  const current = choices.find((choice) => choice.value === value);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={current ? `${label}, ${current.label}` : label}
        onClick={() => setOpen(true)}
        className="flex min-h-[56px] w-full items-center gap-3.5 text-left"
      >
        <span className="min-w-0 flex-1 text-base leading-[22px] font-bold text-ink">{label}</span>
        <span className="text-[15px] font-semibold text-muted">{current?.label}</span>
        <ChevronRight aria-hidden="true" className="size-5 flex-none text-muted" />
      </button>
      <ChoiceSheet
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        choices={choices}
        value={value}
        onPick={onChange}
      />
    </>
  );
}
