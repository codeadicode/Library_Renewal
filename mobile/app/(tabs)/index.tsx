import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { evaluateEligibility, getBook, mockApi } from '@/src/api/mockStore';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Badge, DemoBanner, EmptyState, ErrorBlock, LoadingBlock, SectionTitle } from '@/src/components/ui';
import { daysRemaining, formatDate, urgencyLabel, urgencyTone } from '@/src/domain/loanDisplay';
import { NOW } from '@/src/domain/types';
import { colors, radius, spacing } from '@/src/theme/tokens';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
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

  if (!user) return null;
  if (loansQuery.isLoading) return <LoadingBlock />;
  if (loansQuery.isError) {
    return <ErrorBlock message={(loansQuery.error as Error).message} onRetry={() => loansQuery.refetch()} />;
  }

  const active = (loansQuery.data ?? []).filter((l) => l.status === 'ACTIVE');
  const overdue = active.filter((l) => daysRemaining(l.dueAt) < 0);
  const dueSoon = active.filter((l) => {
    const d = daysRemaining(l.dueAt);
    return d >= 0 && d <= 7;
  });
  const attention = active
    .map((loan) => {
      const book = getBook(loan.bookId);
      const eligibility = evaluateEligibility(loan, user);
      const days = daysRemaining(loan.dueAt);
      return { loan, book, eligibility, days };
    })
    .filter((row) => row.book && (row.days <= 7 || row.loan.markedForReturn || !row.eligibility.eligible && row.days <= 3))
    .sort((a, b) => a.days - b.days);

  const firstName = user.name.split(' ')[0];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View>
        <AppText variant="caption">{format(NOW, 'EEEE d MMMM')}</AppText>
        <AppText variant="title">Hello, {firstName}</AppText>
        <AppText variant="caption">{user.course} · {user.academicYear}</AppText>
      </View>
      <DemoBanner />
      <View style={styles.stats}>
        <Stat label="Borrowed" value={String(active.length)} />
        <Stat label="Due soon" value={String(dueSoon.length)} />
        <Stat label="Overdue" value={String(overdue.length)} danger={overdue.length > 0} />
      </View>

      <SectionTitle>Needs your attention</SectionTitle>
      {attention.length === 0 ? (
        <EmptyState title="Nothing urgent" body="No due dates inside 7 days and no blocked renewals in that window." />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {attention.map((row) => {
            const tone = urgencyTone(row.days);
            const action =
              row.loan.markedForReturn
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
                style={styles.card}>
                <AppText variant="bodyStrong">{row.book!.title}</AppText>
                <AppText variant="caption">{urgencyLabel(row.days)} · Due {formatDate(row.loan.dueAt)}</AppText>
                <View style={styles.badgeRow}>
                  <Badge
                    label={row.eligibility.eligible ? 'Renewal available' : 'Renewal unavailable'}
                    fg={row.eligibility.eligible ? colors.success : colors.danger}
                    bg={row.eligibility.eligible ? colors.successMuted : colors.dangerMuted}
                  />
                  <Badge label={urgencyLabel(row.days)} fg={tone.fg} bg={tone.bg} />
                </View>
                {!row.eligibility.eligible ? (
                  <AppText variant="caption">{row.eligibility.reason}</AppText>
                ) : null}
                <AppText variant="bodyStrong" style={{ color: colors.accent }}>
                  {action}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      )}

      <SectionTitle>On track</SectionTitle>
      {active.filter((l) => daysRemaining(l.dueAt) > 7 && !l.markedForReturn).length === 0 ? (
        <AppText variant="caption">No longer-horizon loans.</AppText>
      ) : (
        active
          .filter((l) => daysRemaining(l.dueAt) > 7 && !l.markedForReturn)
          .map((loan) => {
            const book = getBook(loan.bookId);
            return (
              <AppText key={loan.id} variant="caption">
                {book?.title} · {urgencyLabel(daysRemaining(loan.dueAt))}
              </AppText>
            );
          })
      )}

      <SectionTitle>Recent activity</SectionTitle>
      {(activityQuery.data ?? []).map((item) => (
        <View key={item.id} style={styles.activity}>
          <AppText variant="bodyStrong">{item.title}</AppText>
          <AppText variant="caption">{item.detail}</AppText>
          <AppText variant="label">{formatDate(item.at)}</AppText>
        </View>
      ))}
    </ScrollView>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.stat}>
      <AppText variant="title" style={{ color: danger ? colors.danger : colors.text }}>
        {value}
      </AppText>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  activity: {
    gap: 2,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
