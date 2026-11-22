import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { ImageStyle, StyleSheet, TextStyle, useColorScheme, ViewStyle } from 'react-native';

import { darkColors, lightColors, Palette } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeValue {
  colors: Palette;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');
  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');

  const value = useMemo<ThemeValue>(
    () => ({ colors: isDark ? darkColors : lightColors, isDark, mode, setMode }),
    [isDark, mode],
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
