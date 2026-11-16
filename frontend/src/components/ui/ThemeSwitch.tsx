import { useTheme } from '../../lib/useTheme';
import type { ThemeChoice } from '../../lib/theme';

const options: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function ThemeSwitch() {
  const { choice, setChoice } = useTheme();

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-1.5 text-[13px] font-semibold text-muted">Theme</legend>
      <div className="flex gap-1 rounded-control bg-track p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-[calc(var(--r-control)-4px)] text-[15px] font-bold text-ink has-checked:bg-screen has-checked:text-blue-d has-checked:shadow-sm has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue"
          >
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={choice === option.value}
              onChange={() => setChoice(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
