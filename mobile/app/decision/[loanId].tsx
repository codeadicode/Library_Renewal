import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView } from 'react-native';

import { evaluateEligibility, getBook, mockApi } from '@/src/api/mockStore';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Card, DemoBanner, ErrorBlock, LoadingBlock, PrimaryButton } from '@/src/components/ui';
import { daysRemaining, formatDate, urgencyLabel, urgencyTone } from '@/src/domain/loanDisplay';
import { NeedDecision } from '@/src/domain/types';
import { makeStyles, useTheme } from '@/src/theme/ThemeContext';
import { spacing } from '@/src/theme/tokens';

export default function DecisionScreen() {
  const { loanId } = useLocalSearchParams<{ loanId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const styles = useStyles();
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
          Alert.alert('You still need this book', 'It can be renewed. Confirm on the next screen.');
          router.replace(`/book/${loan.id}`);
        } else {
          Alert.alert('Renewal unavailable', eligibility.reason);
          router.replace(`/alternatives/${book.id}`);
        }
      } else if (decision === 'DONE') {
        Alert.alert('Marked for return', 'Renewal reminders are turned off for this book.');
        router.back();
      } else {
        Alert.alert('Reminder deferred', 'We will remind you once more in 2 days.');
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
  const days = daysRemaining(loan.dueAt);
  const tone = urgencyTone(days, colors);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AppText variant="title">{book?.title ?? 'Loan'}</AppText>
      <AppText variant="bodyStrong" style={{ color: tone.fg }}>
        {urgencyLabel(days)} · Due {formatDate(loan.dueAt)}
      </AppText>
      <AppText variant="body">Nothing is renewed or returned until you confirm. What would you like to do?</AppText>
      <Card style={{ backgroundColor: eligibility.eligible ? colors.accentMuted : colors.pinkMuted, borderWidth: 0 }}>
        <AppText variant="bodyStrong" style={{ color: eligibility.eligible ? colors.accent : colors.pink }}>
          {eligibility.eligible ? 'Renewal available' : 'Renewal unavailable'}
        </AppText>
        <AppText variant="caption">{eligibility.reason}</AppText>
      </Card>
      <PrimaryButton label="Yes, I still need it" onPress={() => decide.mutate('STILL_NEED')} disabled={decide.isPending} />
      <PrimaryButton
        label="No, I'm done with it"
        tone="success"
        onPress={() => decide.mutate('DONE')}
        disabled={decide.isPending}
      />
      <PrimaryButton
        label="I'm not sure yet"
        tone="neutral"
        onPress={() => decide.mutate('NOT_SURE')}
        disabled={decide.isPending}
      />
      <DemoBanner />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: spacing.lg, gap: spacing.md },
}));
