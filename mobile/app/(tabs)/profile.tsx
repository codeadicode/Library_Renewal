import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronRight, GraduationCap, IndianRupee, LogOut, Moon, Pencil, Smartphone, Sun } from 'lucide-react-native';
import { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { mockApi } from '@/src/api/mockStore';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Avatar, Chip, DemoBanner, SectionTitle, Segmented } from '@/src/components/ui';
import { NotificationPreference } from '@/src/domain/types';
import { makeStyles, ThemeMode, useTheme } from '@/src/theme/ThemeContext';
import { radius, spacing } from '@/src/theme/tokens';

const PREFS: { id: NotificationPreference; label: string; hint: string }[] = [
  { id: 'DIGEST', label: 'Daily digest', hint: 'One summary a day' },
  { id: 'IMPORTANT', label: 'Important only', hint: 'Urgent and overdue' },
  { id: 'NORMAL', label: 'Normal', hint: 'Due windows and renewals' },
  { id: 'QUIET', label: 'Quiet mode', hint: 'No reminder spam' },
];

export default function ProfileScreen() {
  const { user, logout, refresh } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useTheme();
  const styles = useStyles();

  const finesQuery = useQuery({
    queryKey: ['fines', user?.id],
    queryFn: () => mockApi.listFines(user!.id),
    enabled: Boolean(user),
  });
  const needsQuery = useQuery({
    queryKey: ['needs', user?.id],
    queryFn: () => mockApi.listNeeds(user!.id),
    enabled: Boolean(user),
  });
  const loansQuery = useQuery({
    queryKey: ['loans', user?.id],
    queryFn: () => mockApi.listLoans(user!.id),
    enabled: Boolean(user),
  });

  if (!user) return null;
  const currentFine = (finesQuery.data ?? []).reduce((sum, f) => sum + f.amount, 0);
  const loans = loansQuery.data ?? [];
  const issued = loans.filter((l) => l.status === 'ACTIVE').length;
  const returned = loans.filter((l) => l.status === 'RETURNED').length;

  async function setPref(id: NotificationPreference) {
    await mockApi.updatePreferences(user!.id, id);
    await refresh();
  }

  const themeOptions: { id: ThemeMode; label: string }[] = [
    { id: 'system', label: 'System' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ];
  const ThemeIcon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Smartphone;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
        <Avatar name={user.name} size={84} />
        <Text style={styles.heroName}>{user.name}</Text>
        <Text style={styles.heroSub}>
          {user.studentId} · {user.email}
        </Text>
        <Text style={styles.heroSub}>
          {user.course} · {user.academicYear}
        </Text>
        <Pressable
          onPress={() => router.push('/edit-profile')}
          style={({ pressed }) => [styles.editBtn, { opacity: pressed ? 0.8 : 1 }]}>
          <Pencil size={15} color={colors.hero} />
          <Text style={[styles.editText, { color: colors.hero }]}>Edit profile</Text>
        </Pressable>
        <View style={styles.heroStats}>
          <MiniStat value={issued} label="Issued" />
          <MiniStat value={returned} label="Returned" />
          <MiniStat value={`₹${currentFine}`} label="Fines" />
        </View>
      </View>

      <View style={styles.body}>
        {user.restricted ? (
          <View style={[styles.card, { backgroundColor: colors.dangerMuted, borderColor: colors.dangerMuted }]}>
            <AppText variant="bodyStrong" style={{ color: colors.danger }}>
              Account restricted
            </AppText>
            <AppText variant="caption">This demo account cannot renew or borrow books.</AppText>
          </View>
        ) : null}

        <SectionTitle>Appearance</SectionTitle>
        <View style={styles.card}>
          <View style={styles.rowInline}>
            <IconBubble bg={colors.accentMuted}>
              <ThemeIcon size={18} color={colors.accent} />
            </IconBubble>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">Theme</AppText>
              <AppText variant="caption">
                {mode === 'system' ? 'Follows your phone setting' : mode === 'dark' ? 'Dark mode on' : 'Light mode on'}
              </AppText>
            </View>
          </View>
          <Segmented options={themeOptions} value={mode} onChange={setMode} />
        </View>

        <SectionTitle>Notifications</SectionTitle>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {PREFS.map((p) => (
              <Chip
                key={p.id}
                label={p.label}
                selected={user.notificationPreference === p.id}
                onPress={() => setPref(p.id)}
                color={colors.pink}
              />
            ))}
          </View>
          <AppText variant="caption">{PREFS.find((p) => p.id === user.notificationPreference)?.hint}</AppText>
        </View>

        <SectionTitle>More</SectionTitle>
        <View style={[styles.card, { gap: 0, paddingVertical: spacing.xs }]}>
          <LinkRow
            icon={<IndianRupee size={18} color={colors.warning} />}
            bg={colors.warningMuted}
            title="Fines"
            sub={`Current demo balance ₹${currentFine}`}
            onPress={() => router.push('/fines')}
          />
          <View style={styles.divider} />
          <LinkRow
            icon={<GraduationCap size={18} color={colors.info} />}
            bg={colors.infoMuted}
            title="Academic needs planner"
            sub={`${needsQuery.data?.length ?? 0} topic${needsQuery.data?.length === 1 ? '' : 's'} saved`}
            onPress={() => router.push('/needs')}
          />
          <View style={styles.divider} />
          <LinkRow
            icon={<LogOut size={18} color={colors.danger} />}
            bg={colors.dangerMuted}
            title="Sign out"
            onPress={logout}
          />
        </View>
        <DemoBanner />
      </View>
    </ScrollView>
  );
}

function MiniStat({ value, label }: { value: string | number; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function IconBubble({ children, bg }: { children: ReactNode; bg: string }) {
  return (
    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
}

function LinkRow({
  icon,
  bg,
  title,
  sub,
  onPress,
}: {
  icon: ReactNode;
  bg: string;
  title: string;
  sub?: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.rowInline, styles.linkRow, { opacity: pressed ? 0.7 : 1 }]}>
      <IconBubble bg={bg}>{icon}</IconBubble>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        {sub ? <AppText variant="caption">{sub}</AppText> : null}
      </View>
      <ChevronRight size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  hero: {
    backgroundColor: c.hero,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: 4,
  },
  heroName: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: spacing.sm },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, textAlign: 'center' },
  editBtn: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  editText: { fontWeight: '800', fontSize: 14 },
  heroStats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, alignSelf: 'stretch' },
  miniStat: {
    flex: 1,
    backgroundColor: c.heroSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  miniValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  miniLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700' },
  body: { padding: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    gap: spacing.md,
  },
  rowInline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  linkRow: { paddingVertical: spacing.md },
  divider: { height: 1, backgroundColor: c.border, marginLeft: 50 },
}));
