import { useId } from 'react';

type SwitchProps = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/** An on/off setting with its label. The whole row is one control, at least 44 px tall. */
export function Switch({ label, description, checked, onChange }: SwitchProps) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-describedby={description ? `${id}-description` : undefined}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-4 text-left"
    >
      <span>
        <span id={`${id}-label`} className="block text-base leading-[22px] font-bold text-ink">
          {label}
        </span>
        {description && (
          <span id={`${id}-description`} className="block text-[13px] leading-[18px] text-muted">
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-8 w-[52px] flex-none rounded-pill transition-colors duration-(--dur-fast) ${
          checked ? 'bg-blue' : 'bg-track'
        }`}
      >
        <span
          className={`absolute top-1 left-1 size-6 rounded-pill bg-screen shadow-sm transition-transform duration-(--dur-fast) ease-soft ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </button>
  );
}
