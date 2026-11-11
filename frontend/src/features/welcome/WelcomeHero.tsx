import { Plane } from 'lucide-react';
import heroLight from '../../assets/illustrations/hero.svg';
import heroDark from '../../assets/illustrations/hero-dark.svg';

function Cloud({ className, style }: { className: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={`absolute fill-hero-cloud ${className}`}
      style={style}
      viewBox="0 0 120 44"
      aria-hidden="true"
    >
      <g>
        <ellipse cx="44" cy="28" rx="38" ry="13" />
        <ellipse cx="74" cy="22" rx="28" ry="15" />
        <ellipse cx="98" cy="30" rx="20" ry="10" />
      </g>
    </svg>
  );
}

function FriendTag({
  name,
  minutes,
  dotClass,
  className,
  delay,
}: {
  name: string;
  minutes: number;
  dotClass: string;
  className: string;
  delay?: string;
}) {
  return (
    <div
      className={`motion-bob glass absolute flex items-center gap-1.5 rounded-[14px] px-3 py-1.5 text-xs font-bold ${className}`}
      style={delay ? ({ '--motion-delay': delay } as React.CSSProperties) : undefined}
    >
      <span className={`size-2.5 flex-none rounded-pill ${dotClass}`} />
      {name} · {minutes} min
    </div>
  );
}

/**
 * The sunrise (or night, in dark mode) scene behind the welcome sheet. Purely decorative, so
 * it is hidden from assistive technology. It extends 112 px below its box, under the sheet.
 */
export function WelcomeHero() {
  return (
    <div aria-hidden="true" className="absolute inset-x-0 top-0 -bottom-28 overflow-hidden">
      <img
        src={heroLight}
        alt=""
        className="absolute inset-0 size-full object-cover object-bottom dark:hidden"
      />
      <img
        src={heroDark}
        alt=""
        className="absolute inset-0 hidden size-full object-cover object-bottom dark:block"
      />

      <Cloud className="motion-drift top-[84px] left-[22px] h-11 w-[120px] opacity-90" />
      <Cloud
        className="motion-drift top-[122px] left-[60%] h-[34px] w-[90px] opacity-85"
        style={{ '--motion-duration': '12s' } as React.CSSProperties}
      />
      <Plane
        className="motion-fly absolute top-[206px] left-0 size-9 fill-hero-plane text-hero-plane-outline"
        strokeWidth={1.3}
      />

      <FriendTag
        name="Aman"
        minutes={14}
        dotClass="bg-friend-3"
        className="right-[26px] bottom-[218px]"
        delay="0.8s"
      />
      <FriendTag name="Priya" minutes={4} dotClass="bg-friend-1" className="bottom-[172px] left-[30px]" />
    </div>
  );
}
