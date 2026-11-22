export const colors = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F5',
  border: '#E2E6EC',
  text: '#1C2430',
  textSecondary: '#5B6573',
  textMuted: '#8A93A0',
  accent: '#3D4FBF',
  accentMuted: '#E8EBF8',
  success: '#2F7D4A',
  successMuted: '#E5F4EA',
  warning: '#B7791F',
  warningMuted: '#F8EEDB',
  danger: '#B42318',
  dangerMuted: '#F8E4E2',
  overlay: 'rgba(28, 36, 48, 0.45)',
  demo: '#5B6573',
} as const;

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
  md: 12,
  lg: 16,
  full: 999,
} as const;

export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30, color: colors.text },
  heading: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24, color: colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22, color: colors.text },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22, color: colors.text },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18, color: colors.textSecondary },
  label: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16, letterSpacing: 0.2, color: colors.textSecondary },
};

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };
