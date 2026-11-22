import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { evaluateEligibility, getBook, mockApi } from '@/src/api/mockStore';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, DemoBanner, ErrorBlock, LoadingBlock, PrimaryButton } from '@/src/components/ui';
import { daysRemaining, formatDate, urgencyLabel } from '@/src/domain/loanDisplay';
import { NeedDecision } from '@/src/domain/types';
import { colors, radius, spacing } from '@/src/theme/tokens';

export default function DecisionScreen() {
  const { loanId } = useLocalSearchParams<{ loanId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const loanQuery = useQuery({
    queryKey: ['loan', user?.id, loanId],
    queryFn: () => mockApi.getLoan(user!.id, loanId),
    enabled: Boolean(user && loanId),
  });

  const decide = useMutation({
    mutationFn: (decision: NeedDecision) => mockApi.decide(user!.id, loanId, decision),
    onSuccess: async (loan, decision) => {
      await queryClient.invalidateQueries();
      const book = getBook(loan.bookId);
      if (decision === 'STILL_NEED' && book) {
        const eligibility = evaluateEligibility(loan, user!);
        if (eligibility.eligible) {
          Alert.alert('You still need this book', 'It is eligible for a simulated renewal. Confirm on the book screen.');
          router.replace(`/book/${loan.id}`);
        } else {
          Alert.alert('Renewal unavailable', eligibility.reason);
          router.replace(`/alternatives/${book.id}`);
        }
      } else if (decision === 'DONE') {
        Alert.alert('Marked for return', 'Renewal reminders are suppressed for this demo loan.');
        router.back();
      } else {
        Alert.alert('Reminder deferred', 'One follow-up is stored for 23 Nov 2026. No extra spam in this prototype.');
        router.back();
      }
    },
  });

  if (loanQuery.isLoading) return <LoadingBlock />;
  if (loanQuery.isError) {
    return <ErrorBlock message={(loanQuery.error as Error).message} onRetry={() => loanQuery.refetch()} />;
  }
  if (!user || !loanQuery.data) return null;

  const loan = loanQuery.data;
  const book = getBook(loan.bookId);
  const eligibility = evaluateEligibility(loan, user);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <DemoBanner />
      <AppText variant="title">{book?.title ?? 'Loan'}</AppText>
      <AppText variant="caption">
        {urgencyLabel(daysRemaining(loan.dueAt))} · Due {formatDate(loan.dueAt)}
      </AppText>
      <AppText variant="body">
        LibTrack will not renew or return this item unless you confirm. Choose how you want to proceed.
      </AppText>
      <View style={styles.card}>
        <AppText variant="bodyStrong">Current eligibility (demo rules)</AppText>
        <AppText variant="caption">{eligibility.reason}</AppText>
      </View>
      <PrimaryButton
        label="Yes, I still need it"
        onPress={() => decide.mutate('STILL_NEED')}
        disabled={decide.isPending}
      />
      <PrimaryButton
        label="No, I'm done with it"
        tone="neutral"
        onPress={() => decide.mutate('DONE')}
        disabled={decide.isPending}
      />
      <PrimaryButton
        label="I'm not sure yet"
        tone="neutral"
        onPress={() => decide.mutate('NOT_SURE')}
        disabled={decide.isPending}
      />
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
    gap: spacing.sm,
  },
});
