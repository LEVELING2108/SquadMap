import { useSyncExternalStore } from 'react';
import { getThemeChoice, setThemeChoice, subscribeToTheme, type ThemeChoice } from './theme';

export function useTheme(): { choice: ThemeChoice; setChoice: (choice: ThemeChoice) => void } {
  const choice = useSyncExternalStore(subscribeToTheme, getThemeChoice);
  return { choice, setChoice: setThemeChoice };
}
