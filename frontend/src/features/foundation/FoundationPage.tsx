import { Button } from '../../components/ui/Button';
import { ThemeSwitch } from '../../components/ui/ThemeSwitch';

const swatches = [
  { name: 'Blue', className: 'bg-blue' },
  { name: 'Coral', className: 'bg-coral' },
  { name: 'Sea', className: 'bg-sea' },
  { name: 'Sun', className: 'bg-sun' },
  { name: 'Green', className: 'bg-green' },
  { name: 'Red', className: 'bg-red' },
];

const people = [
  { name: 'You', className: 'bg-you' },
  { name: 'Priya', className: 'bg-friend-1' },
  { name: 'Aman', className: 'bg-friend-2' },
  { name: 'Rohan', className: 'bg-friend-3' },
];

/**
 * Temporary landing page. It exists to prove the design tokens, fonts and theme
 * switch are wired correctly, and is replaced by the Welcome screen.
 */
export function FoundationPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col gap-4 px-5 py-8">
      <header>
        <h1 className="text-[28px] leading-[34px] font-extrabold tracking-[-0.5px]">SquadMap</h1>
        <p className="mt-1 text-sm leading-5 text-muted">
          Get there together. One link, one live map, everyone's ETA.
        </p>
      </header>

      <section aria-labelledby="status-title" className="glass-strong rounded-card p-5">
        <h2 id="status-title" className="text-base leading-[22px] font-bold">
          Foundations are in place
        </h2>
        <p className="mt-1 text-sm leading-5 text-muted">
          This page checks the design tokens, fonts and theme. Real screens arrive next.
        </p>
        <p className="mt-4 text-xs font-semibold text-muted">Sample trip code</p>
        <p className="font-mono text-[30px] leading-9 tracking-[4px]">K7QX2P9T</p>
      </section>

      <section aria-labelledby="colors-title" className="glass rounded-card p-5">
        <h2 id="colors-title" className="text-base leading-[22px] font-bold">
          Colors
        </h2>
        <ul className="mt-3 grid list-none grid-cols-3 gap-3 p-0">
          {swatches.map((swatch) => (
            <li key={swatch.name} className="flex items-center gap-2 text-sm">
              <span aria-hidden="true" className={`size-6 flex-none rounded-pill ${swatch.className}`} />
              {swatch.name}
            </li>
          ))}
        </ul>
        <h3 className="mt-4 text-xs font-semibold text-muted">People on the map</h3>
        <ul className="mt-2 flex list-none flex-wrap gap-2 p-0">
          {people.map((person) => (
            <li
              key={person.name}
              className={`rounded-pill px-3 py-1 text-xs font-semibold text-on-person ${person.className}`}
            >
              {person.name}
            </li>
          ))}
        </ul>
      </section>

      <ThemeSwitch />

      <div className="mt-auto flex flex-col gap-3">
        <Button>Primary action</Button>
        <Button variant="glass">Secondary action</Button>
      </div>
    </main>
  );
}
