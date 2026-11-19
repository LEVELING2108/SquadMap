import type { ReactNode } from 'react';
import mapLight from '../../assets/illustrations/map.svg';
import mapDark from '../../assets/illustrations/map-dark.svg';
import heroLight from '../../assets/illustrations/hero.svg';
import heroDark from '../../assets/illustrations/hero-dark.svg';
import { BackButton } from '../../components/ui/BackButton';

type AuthScreenProps = {
  /** Accessible name of the sheet; the id of its heading. */
  titleId: string;
  /** Height kept free above the sheet on a 844 px tall phone, as in the design. */
  topSpace: number;
  /** Decoration shown above the sheet. */
  decoration?: ReactNode;
  /** The scene behind everything: a blurred map, or the sky of the welcome screen. */
  backdrop?: 'map' | 'sky';
  children: ReactNode;
};

/**
 * Shared frame for the account screens: a blurred map with the form on a glass sheet.
 * On taller screens the sheet stays at the bottom; on shorter ones the page scrolls.
 */
export function AuthScreen({ titleId, topSpace, decoration, backdrop = 'map', children }: AuthScreenProps) {
  const [light, dark] = backdrop === 'map' ? [mapLight, mapDark] : [heroLight, heroDark];
  // The map is blurred so it reads as a backdrop; the sky is already soft.
  const finish = backdrop === 'map' ? 'scale-105 object-top blur-[3px] saturate-[1.2]' : 'object-top';

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[600px] flex-col overflow-hidden bg-screen">
      <div aria-hidden="true" className="absolute inset-0">
        {/* Scaled up slightly so the blur doesn't leave soft edges. */}
        <img src={light} alt="" className={`size-full object-cover ${finish} dark:hidden`} />
        <img src={dark} alt="" className={`hidden size-full object-cover ${finish} dark:block`} />
      </div>

      <div className="relative flex-1" style={{ minHeight: topSpace }}>
        <BackButton className="absolute top-3 left-3 z-10" />
        {decoration}
      </div>

      <section
        aria-labelledby={titleId}
        className="motion-sheet glass glass-strong relative z-10 flex flex-col gap-3 rounded-t-sheet px-5 pt-3 pb-[max(24px,env(safe-area-inset-bottom))]"
      >
        <div aria-hidden="true" className="mx-auto mb-1 h-1 w-10 flex-none rounded-[2px] bg-handle" />
        {children}
      </section>
    </main>
  );
}
