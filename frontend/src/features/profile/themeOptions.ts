import type { ThemeChoice } from '../../lib/theme';

/** The looks on the Appearance screen, in order, with the words shown for each. */
export const THEME_OPTIONS: readonly { value: ThemeChoice; label: string; description: string }[] = [
  { value: 'system', label: 'Match my phone', description: 'Switches between Light and Dark on its own' },
  { value: 'light', label: 'Light', description: 'The original look: sky blue and frosted glass' },
  { value: 'dark', label: 'Dark', description: 'Deep navy, easier on the eyes at night' },
  { value: 'atlas', label: 'Atlas', description: 'Warm paper, forest ink and vermilion routes' },
];
