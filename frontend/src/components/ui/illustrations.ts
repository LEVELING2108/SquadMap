import heroAtlas from '../../assets/illustrations/hero-atlas.svg';
import heroDark from '../../assets/illustrations/hero-dark.svg';
import heroLight from '../../assets/illustrations/hero.svg';
import mapAtlas from '../../assets/illustrations/map-atlas.svg';
import mapDark from '../../assets/illustrations/map-dark.svg';
import mapLight from '../../assets/illustrations/map.svg';
import type { ResolvedTheme } from '../../lib/theme';

export type IllustrationName = 'hero' | 'map';

const SOURCES: Record<IllustrationName, Record<ResolvedTheme, string>> = {
  hero: { light: heroLight, dark: heroDark, atlas: heroAtlas },
  map: { light: mapLight, dark: mapDark, atlas: mapAtlas },
};

/** The address of a picture from design/assets in its version for a theme. */
export function illustrationSrc(name: IllustrationName, theme: ResolvedTheme): string {
  return SOURCES[name][theme];
}
