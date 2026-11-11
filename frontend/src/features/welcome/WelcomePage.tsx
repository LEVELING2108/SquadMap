import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import { Clock, Compass, Link as LinkIcon, Map as MapIcon } from 'lucide-react';
import { ButtonLink } from '../../components/ui/Button';
import { WelcomeHero } from './WelcomeHero';

/** Entering content rises in 80 ms steps after the sheet. */
const step = (n: number) => ({ '--motion-delay': `${n * 80}ms` }) as CSSProperties;

function Feature({ icon, label, tone }: { icon: ReactNode; label: string; tone: string }) {
  return (
    <li className="flex flex-1 flex-col items-center gap-1.5 text-center text-xs leading-4 font-bold">
      <span aria-hidden="true" className={`flex size-11 items-center justify-center rounded-[16px] ${tone}`}>
        {icon}
      </span>
      {label}
    </li>
  );
}

/** First screen: what SquadMap is, and the ways in (sign up, join with an invite, or log in). */
export function WelcomePage() {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[600px] flex-col overflow-hidden bg-screen">
      <div className="relative min-h-[300px] flex-1">
        <WelcomeHero />

        <div className="glass absolute top-3 left-3 flex h-11 items-center gap-2 rounded-pill pr-4 pl-3 font-extrabold">
          <Compass aria-hidden="true" className="motion-spin size-5 text-blue" strokeWidth={2} />
          SquadMap
        </div>
        <Link
          to="/home"
          className="glass absolute top-3 right-3 inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-bold"
        >
          Skip
        </Link>
      </div>

      <section
        aria-labelledby="welcome-title"
        className="motion-sheet glass glass-strong relative z-10 flex flex-col gap-3 rounded-t-sheet px-5 pt-3 pb-[max(24px,env(safe-area-inset-bottom))]"
      >
        <div aria-hidden="true" className="mx-auto mb-1 h-1 w-10 flex-none rounded-[2px] bg-handle" />

        <div className="motion-rise" style={step(1)}>
          <h1 id="welcome-title" className="text-[28px] leading-[34px] font-extrabold tracking-[-0.5px]">
            Get there <span className="text-blue">together</span>
          </h1>
          <p className="mt-1.5 text-sm leading-5 text-muted">
            See every friend on one live map, from the first step to the last mile.
          </p>
        </div>

        <ul className="motion-rise m-0 flex list-none items-start gap-2 p-0" style={step(2)}>
          <Feature icon={<MapIcon className="size-5" />} label="Live map" tone="bg-tint text-blue-d" />
          <Feature icon={<Clock className="size-5" />} label="Shared ETAs" tone="bg-amber-bg text-amber" />
          <Feature icon={<LinkIcon className="size-5" />} label="Join by link" tone="bg-sea-bg text-sea-d" />
        </ul>

        <div aria-hidden="true" className="motion-rise flex justify-center gap-1.5" style={step(3)}>
          <span className="h-2 w-6 rounded-[4px] bg-blue" />
          <span className="size-2 rounded-[4px] bg-dot-idle" />
          <span className="size-2 rounded-[4px] bg-dot-idle" />
        </div>

        <ButtonLink to="/signup" className="motion-rise" style={step(4)}>
          Get started
        </ButtonLink>
        <ButtonLink to="/join" variant="glass" className="motion-rise" style={step(5)}>
          I have an invite link
        </ButtonLink>
        <p
          className="motion-rise flex min-h-11 items-center justify-center gap-1.5 text-sm leading-5 text-muted"
          style={step(6)}
        >
          Already have an account?
          <Link to="/login" className="inline-flex min-h-11 items-center font-bold text-blue-d">
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}
