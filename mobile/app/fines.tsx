import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, View } from 'react-native';

import { mockApi } from '@/src/api/mockStore';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, DemoBanner, EmptyState, LoadingBlock } from '@/src/components/ui';
import { formatDate } from '@/src/domain/loanDisplay';
import { colors, radius, spacing } from '@/src/theme/tokens';

export default function FinesScreen() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['fines', user?.id],
    queryFn: () => mockApi.listFines(user!.id),
    enabled: Boolean(user),
  });

  if (query.isLoading) return <LoadingBlock />;
  const rows = query.data ?? [];
  const total = rows.reduce((sum, f) => sum + f.amount, 0);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <DemoBanner />
      <AppText variant="title">₹{total}</AppText>
      <AppText variant="caption">
        Simulated balance. No payments. Demo rate ₹{mockApi.policy.finePerDay} per overdue day.
      </AppText>
      {rows.length === 0 ? (
        <EmptyState title="No fine rows" body="This demo account has no ledger entries." />
      ) : (
        rows.map((row) => (
          <View key={row.id} style={styles.card}>
            <AppText variant="bodyStrong">₹{row.amount}</AppText>
            <AppText variant="caption">{row.reason}</AppText>
            <AppText variant="label">{formatDate(row.at)} · simulated</AppText>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
});
