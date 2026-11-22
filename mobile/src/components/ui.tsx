import { ReactNode } from 'react';
import { isApiMode } from '../config';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TextProps,
  View,
  ViewStyle,
} from 'react-native';

import { makeStyles, useTheme } from '../theme/ThemeContext';
import { coverColor, Palette, radius, spacing, TextVariant, typography } from '../theme/tokens';

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const styles = useStyles();
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function AppText({ variant = 'body', style, ...rest }: TextProps & { variant?: TextVariant }) {
  const { colors } = useTheme();
  const color = variant === 'caption' || variant === 'label' ? colors.textSecondary : colors.text;
  return <Text {...rest} style={[typography[variant], { color }, style]} />;
}

export function DemoBanner() {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.demo}>
      <AppText variant="label" style={{ color: colors.info }}>
        {isApiMode
          ? 'LIBTRACK SERVER · simulated college library, not a real record'
          : 'OFFLINE DEMO DATA · not connected to the LibTrack server'}
      </AppText>
    </View>
  );
}

type Tone = 'accent' | 'danger' | 'neutral' | 'success' | 'pink';

function toneColors(tone: Tone, c: Palette): { bg: string; fg: string } {
  switch (tone) {
    case 'danger':
      return { bg: c.danger, fg: '#FFFFFF' };
    case 'success':
      return { bg: c.success, fg: '#FFFFFF' };
    case 'pink':
      return { bg: c.pink, fg: '#FFFFFF' };
    case 'neutral':
      return { bg: c.accentMuted, fg: c.accent };
    default:
      return { bg: c.accent, fg: c.onAccent };
  }
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  tone = 'accent',
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: Tone;
  icon?: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { bg, fg } = toneColors(tone, colors);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
      ]}>
      {icon}
      <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function BookCover({ title, seed, size = 56 }: { title: string; seed?: string; size?: number }) {
  const styles = useStyles();
  const initials = title
    .split(' ')
    .filter((w) => /[A-Za-z]/.test(w[0] ?? ''))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <View
      style={[
        styles.cover,
        { width: size, height: size * 1.3, backgroundColor: coverColor(seed ?? title) },
      ]}>
      <View style={styles.coverSpine} />
      <Text style={[styles.coverText, { fontSize: Math.max(13, size * 0.28) }]}>{initials}</Text>
    </View>
  );
}

export function Avatar({ name, size = 64 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: coverColor(name),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.6)',
      }}>
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  secure,
  keyboardType,
  autoCapitalize,
  placeholder,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  placeholder?: string;
  editable?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label.toUpperCase()}</AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, !editable && { opacity: 0.6 }]}
      />
    </View>
  );
}

export function SearchBox({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      style={styles.input}
    />
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <AppText variant="bodyStrong">{title}</AppText>
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        {body}
      </AppText>
    </View>
  );
}

export function LoadingBlock() {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.empty, styles.fill]}>
      <ActivityIndicator color={colors.accent} />
      <AppText variant="caption">Loading…</AppText>
    </View>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.empty, styles.fill]}>
      <AppText variant="bodyStrong" style={{ color: colors.danger }}>
        Something went wrong
      </AppText>
      <AppText variant="caption">{message}</AppText>
      {onRetry ? <PrimaryButton label="Try again" onPress={onRetry} /> : null}
    </View>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionRow}>
      <AppText variant="heading">{children}</AppText>
      {action}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const active = color ?? colors.accent;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: active, borderColor: active }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <Text style={[styles.chipText, selected && { color: '#FFFFFF' }]}>{label}</Text>
    </Pressable>
  );
}

/** Pill-style segmented control. Each option can carry a count bubble and its own colour. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; count?: number; color?: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const selected = o.id === value;
        const tint = o.color ?? colors.accent;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && { backgroundColor: tint }]}>
            <Text
              numberOfLines={1}
              style={[styles.segmentText, { color: selected ? '#FFFFFF' : colors.textSecondary }]}>
              {o.label}
            </Text>
            {o.count !== undefined ? (
              <View
                style={[
                  styles.segmentCount,
                  { backgroundColor: selected ? 'rgba(255,255,255,0.25)' : colors.surfaceMuted },
                ]}>
                <Text style={[styles.segmentCountText, { color: selected ? '#FFFFFF' : tint }]}>
                  {o.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatTile({
  label,
  value,
  color,
  bg,
  onPress,
}: {
  label: string;
  value: string | number;
  color: string;
  bg: string;
  onPress?: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.stat, { backgroundColor: bg, opacity: pressed ? 0.85 : 1 }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.background,
  },
  fill: { flex: 1, justifyContent: 'center', backgroundColor: c.background },
  demo: {
    backgroundColor: c.infoMuted,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cover: {
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  coverText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  input: {
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: c.surface,
    color: c.text,
    fontSize: 15,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
    gap: spacing.sm,
  },
  empty: {
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chip: {
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipText: {
    color: c.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: radius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: c.border,
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radius.full,
  },
  segmentText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  segmentCount: { minWidth: 20, paddingHorizontal: 5, borderRadius: radius.full, alignItems: 'center' },
  segmentCountText: { fontSize: 11, fontWeight: '800', lineHeight: 18 },
  stat: {
    flex: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  statValue: { fontSize: 26, fontWeight: '800', lineHeight: 32 },
  statLabel: { fontSize: 12, fontWeight: '700' },
}));
