import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView } from 'react-native';

import { api } from '@/src/api';
import { useCatalogue } from '@/src/api/hooks';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Card, DemoBanner, ErrorBlock, LoadingBlock, PrimaryButton } from '@/src/components/ui';
import { daysRemaining, describeAcademicContext, formatDate, urgencyLabel, urgencyTone } from '@/src/domain/loanDisplay';
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
  const catalogue = useCatalogue();

  const loanQuery = useQuery({
    queryKey: ['loan', user?.id, loanId],
    queryFn: () => api.getLoan(user!.id, loanId),
    enabled: Boolean(user && loanId),
  });
  const eligibilityQuery = useQuery({
    queryKey: ['eligibility', user?.id, loanId],
    queryFn: () => api.eligibility(user!.id, loanId),
    enabled: Boolean(user && loanId),
  });

  const decide = useMutation({
    mutationFn: (decision: NeedDecision) => api.decide(user!.id, loanId, decision),
    onSuccess: async (loan, decision) => {
      await queryClient.invalidateQueries();
      if (decision === 'STILL_NEED') {
        // Ask the server again: eligibility may have changed since the screen loaded.
        const eligibility = await api.eligibility(user!.id, loan.id);
        if (eligibility.eligible) {
          Alert.alert('You still need this book', 'It can be renewed. Confirm on the next screen.');
          router.replace(`/book/${loan.id}`);
        } else {
          Alert.alert('Renewal unavailable', eligibility.reason);
          router.replace(`/alternatives/${loan.bookId}`);
        }
      } else if (decision === 'DONE') {
        Alert.alert('Marked for return', 'Due-soon reminders are switched off for this book.');
        router.back();
      } else {
        const when = loan.followUpAt ? formatDate(loan.followUpAt) : 'in 2 days';
        Alert.alert('Reminder scheduled', `We will ask you once more on ${when}.`);
        router.back();
      }
    },
    onError: (e: Error) => Alert.alert('Could not save decision', e.message),
  });

  if (loanQuery.isLoading || eligibilityQuery.isLoading) return <LoadingBlock />;
  const failed = loanQuery.isError ? loanQuery : eligibilityQuery.isError ? eligibilityQuery : null;
  if (failed) {
    return <ErrorBlock message={(failed.error as Error).message} onRetry={() => failed.refetch()} />;
  }
  if (!user || !loanQuery.data || !eligibilityQuery.data) return null;

  const loan = loanQuery.data;
  const eligibility = eligibilityQuery.data;
  const book = catalogue.getBook(loan.bookId);
  const days = daysRemaining(loan.dueAt);
  const tone = urgencyTone(days, colors);
  const ctx = eligibility.academicContext;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AppText variant="title">{book?.title ?? 'Loan'}</AppText>
      <AppText variant="bodyStrong" style={{ color: tone.fg }}>
        {urgencyLabel(days)} · Due {formatDate(loan.dueAt)}
      </AppText>
      <AppText variant="body">Nothing is renewed or returned until you confirm. What would you like to do?</AppText>

      {ctx ? (
        <Card style={{ backgroundColor: colors.infoMuted, borderWidth: 0 }}>
          <AppText variant="bodyStrong" style={{ color: colors.info }}>
            Your academic plan
          </AppText>
          <AppText variant="caption">{describeAcademicContext(ctx)}</AppText>
        </Card>
      ) : null}

      <Card style={{ backgroundColor: eligibility.eligible ? colors.accentMuted : colors.pinkMuted, borderWidth: 0 }}>
        <AppText variant="bodyStrong" style={{ color: eligibility.eligible ? colors.accent : colors.pink }}>
          {eligibility.eligible ? 'Renewal available' : 'Renewal unavailable'}
        </AppText>
        <AppText variant="caption">{eligibility.reason}</AppText>
      </Card>

      <PrimaryButton label="Yes, I still need it" onPress={() => decide.mutate('STILL_NEED')} disabled={decide.isPending} />
      <PrimaryButton label="No, I'm done with it" tone="success" onPress={() => decide.mutate('DONE')} disabled={decide.isPending} />
      <PrimaryButton label="I'm not sure yet" tone="neutral" onPress={() => decide.mutate('NOT_SURE')} disabled={decide.isPending} />
      <DemoBanner />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: spacing.lg, gap: spacing.md },
}));
