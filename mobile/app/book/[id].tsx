import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { evaluateEligibility, getBook, mockApi, topicName } from '@/src/api/mockStore';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Badge, DemoBanner, ErrorBlock, LoadingBlock, PrimaryButton } from '@/src/components/ui';
import {
  daysRemaining,
  eligibilityTone,
  formatDate,
  urgencyLabel,
  urgencyTone,
} from '@/src/domain/loanDisplay';
import { colors, radius, spacing } from '@/src/theme/tokens';

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const loanQuery = useQuery({
    queryKey: ['loan', user?.id, id],
    queryFn: () => mockApi.getLoan(user!.id, id),
    enabled: Boolean(user && id),
  });
  const historyQuery = useQuery({
    queryKey: ['renewal-history', user?.id, id],
    queryFn: () => mockApi.renewalHistory(user!.id, id),
    enabled: Boolean(user && id),
  });

  const renew = useMutation({
    mutationFn: () => mockApi.renew(user!.id, id),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries();
      if (result.ok) {
        Alert.alert('Renewed (simulated)', `New due date saved in this demo session.`);
      } else {
        Alert.alert('Renewal not completed', result.result.reason);
      }
    },
    onError: (e: Error) => Alert.alert('Could not renew', e.message),
  });

  if (loanQuery.isLoading) return <LoadingBlock />;
  if (loanQuery.isError) {
    return <ErrorBlock message={(loanQuery.error as Error).message} onRetry={() => loanQuery.refetch()} />;
  }
  if (!user || !loanQuery.data) return null;

  const loan = loanQuery.data;
  const book = getBook(loan.bookId);
  if (!book) return <ErrorBlock message="Book record missing from demo catalogue." />;

  const eligibility = evaluateEligibility(loan, user);
  const days = daysRemaining(loan.dueAt);
  const urgency = urgencyTone(days);
  const elig = eligibilityTone(eligibility);
  const estimated = mockApi.estimateFine(loan);

  function confirmRenew() {
    Alert.alert(
      'Confirm simulated renewal',
      'This only updates the in-memory demo loan. It does not change a college library.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Renew', onPress: () => renew.mutate() },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <DemoBanner />
      <AppText variant="title">{book.title}</AppText>
      <AppText variant="caption">{book.author}</AppText>
      <AppText variant="caption">ISBN {book.isbn} · {book.category}</AppText>
      <View style={styles.badgeRow}>
        <Badge label={urgencyLabel(days)} fg={urgency.fg} bg={urgency.bg} />
        <Badge label={elig.label} fg={elig.fg} bg={elig.bg} />
        {loan.markedForReturn ? (
          <Badge label="Marked for return" fg={colors.textSecondary} bg={colors.surfaceMuted} />
        ) : null}
      </View>
      <View style={styles.block}>
        <Row label="Issued" value={formatDate(loan.issuedAt)} />
        <Row label="Due" value={formatDate(loan.dueAt)} />
        <Row label="Renewals used" value={`${loan.renewalCount} / ${mockApi.policy.maxRenewals}`} />
        <Row label="Copy" value={loan.copyId} />
        <Row label="Need decision" value={loan.needDecision ?? 'Not recorded'} />
      </View>
      <AppText variant="body">{book.description}</AppText>
      <AppText variant="label">RELATED TOPICS</AppText>
      <AppText variant="caption">{book.topicIds.map(topicName).join(' · ')}</AppText>
      <AppText variant="bodyStrong">Eligibility</AppText>
      <AppText variant="caption">{eligibility.reason}</AppText>
      <AppText variant="label">{eligibility.reasonCode}</AppText>
      {estimated > 0 ? (
        <AppText variant="caption" style={{ color: colors.danger }}>
          Estimated simulated fine if returned now: ₹{estimated} ({mockApi.policy.finePerDay}/day).
        </AppText>
      ) : null}

      <PrimaryButton label="Check renewal eligibility" tone="neutral" onPress={() => loanQuery.refetch()} />
      <PrimaryButton
        label={renew.isPending ? 'Working…' : 'Renew book'}
        onPress={confirmRenew}
        disabled={!eligibility.eligible || loan.markedForReturn || renew.isPending}
      />
      <PrimaryButton label="Still need this book?" tone="neutral" onPress={() => router.push(`/decision/${loan.id}`)} />
      <PrimaryButton
        label="Find alternative resources"
        tone="neutral"
        onPress={() => router.push(`/alternatives/${book.id}`)}
      />

      <AppText variant="heading">Renewal history</AppText>
      {(historyQuery.data ?? []).length === 0 ? (
        <AppText variant="caption">No attempts on this loan yet.</AppText>
      ) : (
        (historyQuery.data ?? []).map((item) => (
          <View key={item.id} style={styles.history}>
            <AppText variant="bodyStrong">{item.reasonCode}</AppText>
            <AppText variant="caption">{item.reason}</AppText>
            <AppText variant="label">{formatDate(item.at)}</AppText>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  block: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  history: { gap: 2, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
