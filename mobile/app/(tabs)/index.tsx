import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { availablePhysicalCount, evaluateEligibility, getBook, mockApi } from '@/src/api/mockStore';
import { useAuth } from '@/src/auth/AuthContext';
import {
  AppText,
  Avatar,
  Badge,
  BookCover,
  DemoBanner,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  SectionTitle,
} from '@/src/components/ui';
import { daysRemaining, eligibilityTone, formatDate, urgencyLabel, urgencyTone } from '@/src/domain/loanDisplay';
import { ActivityKind, BookFilter, NOW } from '@/src/domain/types';
import { makeStyles, useTheme } from '@/src/theme/ThemeContext';
import { Palette, radius, spacing } from '@/src/theme/tokens';

function activityColor(kind: ActivityKind, c: Palette): string {
  switch (kind) {
    case 'RENEWAL_SUCCESS':
      return c.success;
    case 'RENEWAL_FAILED':
      return c.danger;
    case 'RETURNED':
      return c.info;
    case 'RESERVATION_UPDATE':
      return c.pink;
    case 'DECISION':
      return c.accent;
    default:
      return c.warning;
  }
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();

  const loansQuery = useQuery({
    queryKey: ['loans', user?.id],
    queryFn: () => mockApi.listLoans(user!.id),
    enabled: Boolean(user),
  });
  const activityQuery = useQuery({
    queryKey: ['activity', user?.id],
    queryFn: () => mockApi.listActivity(user!.id),
    enabled: Boolean(user),
  });
  const availableQuery = useQuery({
    queryKey: ['books', 'home-available'],
    queryFn: () => mockApi.listBooks({ available: true, type: 'PHYSICAL' }),
  });

  if (!user) return null;
  if (loansQuery.isLoading) return <LoadingBlock />;
  if (loansQuery.isError) {
    return <ErrorBlock message={(loansQuery.error as Error).message} onRetry={() => loansQuery.refetch()} />;
  }

  const all = loansQuery.data ?? [];
  const count = (f: BookFilter) => all.filter((l) => mockApi.loanMatchesFilter(l, f)).length;
  const active = all.filter((l) => l.status === 'ACTIVE');
  const issuedIds = new Set(active.map((l) => l.bookId));

  const attention = active
    .map((loan) => ({
      loan,
      book: getBook(loan.bookId),
      eligibility: evaluateEligibility(loan, user),
      days: daysRemaining(loan.dueAt),
    }))
    .filter((row) => row.book && (row.days <= 7 || row.loan.markedForReturn))
    .sort((a, b) => a.days - b.days);

  const onTrack = active.filter((l) => daysRemaining(l.dueAt) > 7 && !l.markedForReturn);
  const available = (availableQuery.data ?? []).filter((b) => !issuedIds.has(b.id)).slice(0, 10);
  const firstName = user.name.split(' ')[0];
  const openBooks = (filter: BookFilter) => router.push({ pathname: '/(tabs)/books', params: { filter } });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroDate}>{format(NOW, 'EEEE, d MMMM')}</Text>
            <Text style={styles.heroTitle}>Hello, {firstName}!</Text>
            <Text style={styles.heroSub}>
              {user.course} · {user.academicYear}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/profile')}>
            <Avatar name={user.name} size={56} />
          </Pressable>
        </View>
        <View style={styles.heroStats}>
          <HeroStat label="Issued" value={count('ISSUED')} onPress={() => openBooks('ISSUED')} />
          <HeroStat label="Due soon" value={count('DUE_SOON')} onPress={() => openBooks('DUE_SOON')} />
          <HeroStat label="Overdue" value={count('OVERDUE')} onPress={() => openBooks('OVERDUE')} alert />
          <HeroStat label="Returned" value={count('RETURNED')} onPress={() => openBooks('RETURNED')} />
        </View>
      </View>

      <View style={styles.body}>
        <DemoBanner />

        <SectionTitle>Needs your attention</SectionTitle>
        {attention.length === 0 ? (
          <View style={[styles.card, { alignItems: 'center' }]}>
            <EmptyState title="All caught up" body="Nothing is due in the next 7 days." />
          </View>
        ) : (
          attention.map((row) => {
            const tone = urgencyTone(row.days, colors);
            const elig = eligibilityTone(row.eligibility, colors);
            const action = row.loan.markedForReturn
              ? 'Prepare return'
              : row.eligibility.eligible
                ? 'Check renewal'
                : row.eligibility.suggestedAction === 'FIND_ALTERNATIVE'
                  ? 'Find alternatives'
                  : 'Review';
            return (
              <Pressable
                key={row.loan.id}
                onPress={() => router.push(`/decision/${row.loan.id}`)}
                style={({ pressed }) => [styles.card, styles.attnCard, { borderLeftColor: tone.fg, opacity: pressed ? 0.85 : 1 }]}>
                <BookCover title={row.book!.title} seed={row.book!.category + row.book!.id} size={46} />
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="bodyStrong" numberOfLines={2}>
                    {row.book!.title}
                  </AppText>
                  <AppText variant="caption">Due {formatDate(row.loan.dueAt)}</AppText>
                  <View style={styles.badgeRow}>
                    <Badge label={urgencyLabel(row.days)} fg={tone.fg} bg={tone.bg} />
                    <Badge label={elig.label} fg={elig.fg} bg={elig.bg} />
                  </View>
                  {!row.eligibility.eligible ? (
                    <AppText variant="caption">{row.eligibility.reason}</AppText>
                  ) : null}
                  <View style={styles.actionRow}>
                    <AppText variant="bodyStrong" style={{ color: colors.accent }}>
                      {action}
                    </AppText>
                    <ChevronRight size={16} color={colors.accent} />
                  </View>
                </View>
              </Pressable>
            );
          })
        )}

        <SectionTitle
          action={
            <Pressable onPress={() => router.push('/(tabs)/discover')} hitSlop={8}>
              <AppText variant="bodyStrong" style={{ color: colors.accent }}>
                See all
              </AppText>
            </Pressable>
          }>
          Available to borrow
        </SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
          {available.map((book) => {
            const n = availablePhysicalCount(book.id);
            return (
              <Pressable
                key={book.id}
                onPress={() => router.push(`/catalogue/${book.id}`)}
                style={({ pressed }) => [styles.shelfCard, { opacity: pressed ? 0.85 : 1 }]}>
                <BookCover title={book.title} seed={book.category + book.id} size={84} />
                <AppText variant="bodyStrong" numberOfLines={2} style={{ fontSize: 14, lineHeight: 19 }}>
                  {book.title}
                </AppText>
                <AppText variant="caption" numberOfLines={1}>
                  {book.author}
                </AppText>
                <Badge label={`${n} available`} fg={colors.success} bg={colors.successMuted} />
              </Pressable>
            );
          })}
        </ScrollView>

        {onTrack.length > 0 ? (
          <>
            <SectionTitle>On track</SectionTitle>
            <View style={styles.card}>
              {onTrack.map((loan) => (
                <Pressable key={loan.id} onPress={() => router.push(`/book/${loan.id}`)} style={styles.trackRow}>
                  <View style={[styles.dot, { backgroundColor: colors.success }]} />
                  <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                    {getBook(loan.bookId)?.title}
                  </AppText>
                  <AppText variant="caption">{urgencyLabel(daysRemaining(loan.dueAt))}</AppText>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <SectionTitle>Recent activity</SectionTitle>
        <View style={styles.card}>
          {(activityQuery.data ?? []).length === 0 ? (
            <AppText variant="caption">No activity yet.</AppText>
          ) : (
            (activityQuery.data ?? []).map((item) => (
              <View key={item.id} style={styles.activity}>
                <View style={[styles.dot, { backgroundColor: activityColor(item.kind, colors), marginTop: 6 }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong">{item.title}</AppText>
                  <AppText variant="caption">{item.detail}</AppText>
                  <AppText variant="label" style={{ color: colors.textMuted }}>
                    {formatDate(item.at)}
                  </AppText>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function HeroStat({
  label,
  value,
  onPress,
  alert,
}: {
  label: string;
  value: number;
  onPress: () => void;
  alert?: boolean;
}) {
  const styles = useStyles();
  const hot = alert && value > 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.heroStat, hot && styles.heroStatHot, { opacity: pressed ? 0.8 : 1 }]}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  hero: {
    backgroundColor: c.hero,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: spacing.lg,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroDate: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', lineHeight: 34 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  heroStats: { flexDirection: 'row', gap: spacing.sm },
  heroStat: {
    flex: 1,
    backgroundColor: c.heroSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  heroStatHot: { backgroundColor: '#F04461' },
  heroStatValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', lineHeight: 28 },
  heroStatLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700' },
  body: { padding: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    gap: spacing.sm,
  },
  attnCard: { flexDirection: 'row', gap: spacing.md, borderLeftWidth: 5 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  shelfCard: {
    width: 140,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
    borderWidth: 1,
    borderColor: c.border,
  },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  activity: { flexDirection: 'row', gap: spacing.md, paddingVertical: 6 },
}));
