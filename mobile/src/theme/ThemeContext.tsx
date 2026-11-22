import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ImageStyle, StyleSheet, TextStyle, useColorScheme, ViewStyle } from 'react-native';

import { secureStorage, STORAGE_KEYS } from '../storage/secureStorage';
import { darkColors, lightColors, Palette } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

const MODES: ThemeMode[] = ['system', 'light', 'dark'];

interface ThemeValue {
  colors: Palette;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Restore the saved choice. Until it loads the system theme is shown.
  useEffect(() => {
    let cancelled = false;
    secureStorage.get(STORAGE_KEYS.themeMode).then((saved) => {
      if (!cancelled && saved && MODES.includes(saved as ThemeMode)) setModeState(saved as ThemeMode);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void secureStorage.set(STORAGE_KEYS.themeMode, next);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');

  const value = useMemo<ThemeValue>(
    () => ({ colors: isDark ? darkColors : lightColors, isDark, mode, setMode }),
    [isDark, mode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/**
 * Build a theme-aware stylesheet hook:
 *   const useStyles = makeStyles((c) => ({ card: { backgroundColor: c.surface } }));
 *   const styles = useStyles();
 */
type NamedStyles = { [key: string]: ViewStyle | TextStyle | ImageStyle };

export function makeStyles<T extends NamedStyles>(factory: (colors: Palette) => T & NamedStyles) {
  return function useStyles(): Readonly<T> {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
