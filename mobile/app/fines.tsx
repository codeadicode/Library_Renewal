import { useQuery } from '@tanstack/react-query';
import { ScrollView, Text, View } from 'react-native';

import { mockApi } from '@/src/api/mockStore';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Card, DemoBanner, EmptyState, LoadingBlock } from '@/src/components/ui';
import { formatDate } from '@/src/domain/loanDisplay';
import { makeStyles, useTheme } from '@/src/theme/ThemeContext';
import { radius, spacing } from '@/src/theme/tokens';

export default function FinesScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles();
  const query = useQuery({
    queryKey: ['fines', user?.id],
    queryFn: () => mockApi.listFines(user!.id),
    enabled: Boolean(user),
  });

  if (query.isLoading) return <LoadingBlock />;
  const rows = query.data ?? [];
  const total = rows.reduce((sum, f) => sum + f.amount, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.total, { backgroundColor: total > 0 ? colors.danger : colors.success }]}>
        <Text style={styles.totalLabel}>{total > 0 ? 'Outstanding (demo)' : 'No fines'}</Text>
        <Text style={styles.totalValue}>₹{total}</Text>
        <Text style={styles.totalLabel}>₹{mockApi.policy.finePerDay} per overdue day · no real payments</Text>
      </View>
      {rows.length === 0 ? (
        <EmptyState title="All clear" body="You have no fines on this account." />
      ) : (
        rows.map((row) => (
          <Card key={row.id} style={{ gap: 4 }}>
            <AppText variant="heading" style={{ color: colors.danger }}>
              ₹{row.amount}
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
  total: { borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: 4 },
  totalValue: { color: '#FFFFFF', fontSize: 40, fontWeight: '800' },
  totalLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600', textAlign: 'center' },
}));
