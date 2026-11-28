import { Info } from 'lucide-react';
import { BackButton } from '../../components/ui/BackButton';
import { illustrationSrc } from '../../components/ui/illustrations';
import type { ResolvedTheme, ThemeChoice } from '../../lib/theme';
import { useTheme } from '../../lib/useTheme';
import { THEME_OPTIONS } from './themeOptions';

/** A small piece of map in one theme, with a dotted route to a destination, drawn in that theme's colours. */
function Swatch({ theme, className = '' }: { theme: ResolvedTheme; className?: string }) {
  return (
    <div data-theme={theme} className={`relative overflow-hidden bg-screen ${className}`}>
      <img
        src={illustrationSrc('map', theme)}
        alt=""
        className="absolute inset-0 size-full object-cover object-[30%_40%]"
      />
      <svg viewBox="0 0 64 88" className="absolute inset-0 size-full" preserveAspectRatio="none">
        <path
          d="M18 70 C 24 56, 30 46, 44 24"
          fill="none"
          stroke="var(--you)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="0.1 6"
        />
        <circle cx="18" cy="70" r="5" fill="var(--you)" stroke="var(--screen)" strokeWidth="2" />
        <circle cx="44" cy="24" r="6" fill="var(--coral)" stroke="var(--screen)" strokeWidth="2" />
      </svg>
    </div>
  );
}

function Preview({ choice }: { choice: ThemeChoice }) {
  const frame = 'relative h-[88px] w-16 flex-none overflow-hidden rounded-control border border-line';
  if (choice === 'system') {
    return (
      <div aria-hidden="true" className={`${frame} flex`}>
        <Swatch theme="light" className="h-full w-1/2" />
        <Swatch theme="dark" className="h-full w-1/2" />
      </div>
    );
  }
  return (
    <div aria-hidden="true" className={frame}>
      <Swatch theme={choice} className="size-full" />
    </div>
  );
}

/**
 * Appearance (Settings > Theme): Match my phone, Light, Dark or Atlas, each with a small preview drawn in
 * its own colours. The app changes look the moment one is picked. The choice belongs to this device.
 */
export function AppearancePage() {
  const { choice, setChoice } = useTheme();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col gap-4 bg-sand px-3 pt-3 pb-8">
      <header className="flex items-center gap-2">
        <BackButton fallback="/me/settings" className="bg-transparent shadow-none" />
        <h1 className="font-heading text-[22px] leading-7 tracking-[-0.3px]">Appearance</h1>
      </header>

      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-3 px-2 text-[15px] leading-[22px] text-muted">
          Pick how SquadMap looks on this device. It changes as soon as you tap.
        </legend>
        {THEME_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="glass-strong flex cursor-pointer items-center gap-4 rounded-card p-3 outline-offset-2 has-checked:border-2 has-checked:border-ink has-checked:p-[11px] has-focus-visible:outline-3 has-focus-visible:outline-blue"
          >
            <Preview choice={option.value} />
            <span className="min-w-0 flex-1">
              <span className="block text-base leading-[22px] font-bold text-ink">{option.label}</span>
              <span
                id={`theme-${option.value}-description`}
                className="block text-[13px] leading-[18px] text-muted"
              >
                {option.description}
              </span>
            </span>
            <input
              type="radio"
              name="theme"
              value={option.value}
              aria-label={option.label}
              aria-describedby={`theme-${option.value}-description`}
              checked={choice === option.value}
              onChange={() => setChoice(option.value)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="flex size-7 flex-none items-center justify-center rounded-pill border-2 border-ink after:size-3.5 after:rounded-pill after:bg-ink after:opacity-0 peer-checked:after:opacity-100"
            />
          </label>
        ))}
      </fieldset>

      <p className="glass-strong m-0 flex items-start gap-3 rounded-card p-4 text-[13px] leading-[18px] text-muted">
        <Info aria-hidden="true" className="size-5 flex-none text-ink" />
        With the Streets map, Dark also darkens the map, and Match my phone does too when your phone is in
        dark mode.
      </p>
    </main>
  );
}
