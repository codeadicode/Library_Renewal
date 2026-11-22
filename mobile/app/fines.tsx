import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { api } from '@/src/api';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Card, DemoBanner, EmptyState, ErrorBlock, LoadingBlock, SectionTitle } from '@/src/components/ui';
import { formatDate, formatRupees } from '@/src/domain/loanDisplay';
import { makeStyles, useTheme } from '@/src/theme/ThemeContext';
import { radius, spacing } from '@/src/theme/tokens';

/**
 * Two clearly separate numbers:
 *  - "Owed": charges recorded in the fine ledger when a late book was returned.
 *  - "Accruing": what currently-overdue books would add if returned today.
 *    It is an estimate and is never added to the owed total.
 */
export default function FinesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const query = useQuery({
    queryKey: ['fines', user?.id],
    queryFn: () => api.getFines(user!.id),
    enabled: Boolean(user),
  });

  if (query.isLoading) return <LoadingBlock />;
  if (query.isError || !query.data) {
    return <ErrorBlock message={(query.error as Error)?.message ?? 'Could not load fines.'} onRetry={() => query.refetch()} />;
  }

  const { ledger, estimates, dailyRate } = query.data;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.totals}>
        <View style={[styles.total, { backgroundColor: ledger.total > 0 ? colors.danger : colors.success }]}>
          <Text style={styles.totalLabel}>Owed (fine ledger)</Text>
          <Text style={styles.totalValue}>{formatRupees(ledger.total)}</Text>
        </View>
        <View style={[styles.total, { backgroundColor: estimates.total > 0 ? colors.warning : colors.surface, borderWidth: estimates.total > 0 ? 0 : 1, borderColor: colors.border }]}>
          <Text style={[styles.totalLabel, estimates.total === 0 && { color: colors.textMuted }]}>Accruing (estimate)</Text>
          <Text style={[styles.totalValue, estimates.total === 0 && { color: colors.text }]}>{formatRupees(estimates.total)}</Text>
        </View>
      </View>
      <AppText variant="caption">
        {formatRupees(dailyRate)} per overdue day. Estimates become ledger charges only when the book is returned. No real
        payments are taken.
      </AppText>

      <SectionTitle>Accruing on overdue books</SectionTitle>
      {estimates.loans.length === 0 ? (
        <AppText variant="caption">No overdue books — nothing is accruing.</AppText>
      ) : (
        estimates.loans.map((row) => (
          <Pressable key={row.loanId} onPress={() => router.push(`/book/${row.loanId}`)}>
            <Card style={{ gap: 4, borderColor: colors.warning }}>
              <AppText variant="bodyStrong" style={{ color: colors.warning }}>
                {formatRupees(row.estimatedFine)} if returned today
              </AppText>
              <AppText variant="caption">
                {row.bookTitle} · {row.daysOverdue} day{row.daysOverdue === 1 ? '' : 's'} overdue
              </AppText>
            </Card>
          </Pressable>
        ))
      )}

      <SectionTitle>Fine ledger</SectionTitle>
      {ledger.entries.length === 0 ? (
        <EmptyState title="All clear" body="No fines have been recorded on this account." />
      ) : (
        ledger.entries.map((row) => (
          <Card key={row.id} style={{ gap: 4 }}>
            <AppText variant="heading" style={{ color: colors.danger }}>
              {formatRupees(row.amount)}
            </AppText>
            <AppText variant="caption">{row.reason}</AppText>
            <AppText variant="label" style={{ color: colors.textMuted }}>
              {formatDate(row.at)}
            </AppText>
          </Card>
        ))
      )}
      <DemoBanner />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: spacing.lg, gap: spacing.md },
  totals: { flexDirection: 'row', gap: spacing.md },
  total: { flex: 1, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: 4 },
  totalValue: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
  totalLabel: { color: 'rgba(255,255,255,0.92)', fontSize: 12, fontWeight: '700', textAlign: 'center' },
}));
