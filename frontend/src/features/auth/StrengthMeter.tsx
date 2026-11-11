import { passwordStrength } from './passwordStrength';

const fill = { red: 'bg-red', amber: 'bg-amber', green: 'bg-green' } as const;

/** Bar plus a word, so strength is never shown by colour alone. */
export function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const strength = passwordStrength(password);

  return (
    <div className="flex items-center gap-2">
      <div aria-hidden="true" className="relative h-1.5 flex-1 overflow-hidden rounded-[3px] bg-track">
        <span
          className={`absolute inset-y-0 left-0 rounded-[3px] transition-[width] duration-(--dur-base) ease-soft ${fill[strength.tone]}`}
          style={{ width: `${strength.percent}%` }}
        />
      </div>
      <span aria-live="polite" className="text-xs leading-4 font-bold text-muted">
        <span className="sr-only">Password strength: </span>
        {strength.label}
      </span>
    </div>
  );
}
