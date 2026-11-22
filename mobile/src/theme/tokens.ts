export interface Palette {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentMuted: string;
  onAccent: string;
  pink: string;
  pinkMuted: string;
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  danger: string;
  dangerMuted: string;
  info: string;
  infoMuted: string;
  hero: string;
  heroSoft: string;
  overlay: string;
}

export const lightColors: Palette = {
  background: '#F5F3FF',
  surface: '#FFFFFF',
  surfaceMuted: '#EEEBFC',
  border: '#E4E0F7',
  text: '#1B1830',
  textSecondary: '#5B5778',
  textMuted: '#8D89A8',
  accent: '#6D4AFF',
  accentMuted: '#ECE6FF',
  onAccent: '#FFFFFF',
  pink: '#E8458B',
  pinkMuted: '#FDE4EF',
  success: '#15924A',
  successMuted: '#DCF7E6',
  warning: '#C46A00',
  warningMuted: '#FFEFD5',
  danger: '#D92D20',
  dangerMuted: '#FEE4E2',
  info: '#0A7BC2',
  infoMuted: '#DDF1FD',
  hero: '#6D4AFF',
  heroSoft: 'rgba(255,255,255,0.18)',
  overlay: 'rgba(27, 24, 48, 0.45)',
};

export const darkColors: Palette = {
  background: '#100E1C',
  surface: '#1B1830',
  surfaceMuted: '#26223F',
  border: '#332E52',
  text: '#F3F1FF',
  textSecondary: '#BAB5D9',
  textMuted: '#837EA6',
  accent: '#9A80FF',
  accentMuted: '#2D2654',
  onAccent: '#FFFFFF',
  pink: '#FF6FAE',
  pinkMuted: '#3D1D31',
  success: '#4ADE80',
  successMuted: '#123222',
  warning: '#FBBF24',
  warningMuted: '#3A2A0B',
  danger: '#F87171',
  dangerMuted: '#3E1716',
  info: '#38BDF8',
  infoMuted: '#0B2A3D',
  hero: '#4B32C7',
  heroSoft: 'rgba(255,255,255,0.14)',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

/** Bright cover colours for book cards. White text reads on all of them. */
export const coverPalette = [
  '#6D4AFF',
  '#E8458B',
  '#E07A10',
  '#12A57A',
  '#0A8FD6',
  '#D63B3B',
  '#9B44E0',
  '#0F9AA8',
];

export function coverColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return coverPalette[Math.abs(hash) % coverPalette.length];
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  full: 999,
} as const;

export type TextVariant = 'hero' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'label';

export const typography: Record<
  TextVariant,
  { fontSize: number; fontWeight: '400' | '600' | '700' | '800'; lineHeight: number; letterSpacing?: number }
> = {
  hero: { fontSize: 28, fontWeight: '800', lineHeight: 34 },
  title: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  heading: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700', lineHeight: 16, letterSpacing: 0.4 },
};

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };
