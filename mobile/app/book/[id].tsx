import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, Text, View } from 'react-native';

import { api } from '@/src/api';
import { useCatalogue, usePolicy } from '@/src/api/hooks';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Badge, BookCover, Card, DemoBanner, ErrorBlock, LoadingBlock, PrimaryButton } from '@/src/components/ui';
import {
  daysRemaining,
  describeAcademicContext,
  eligibilityTone,
  formatDate,
  formatRupees,
  urgencyLabel,
  urgencyTone,
} from '@/src/domain/loanDisplay';
import { makeStyles, useTheme } from '@/src/theme/ThemeContext';
import { coverColor, radius, spacing } from '@/src/theme/tokens';

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const styles = useStyles();
  const catalogue = useCatalogue();
  const policy = usePolicy();
  const enabled = Boolean(user && id);

  const loanQuery = useQuery({ queryKey: ['loan', user?.id, id], queryFn: () => api.getLoan(user!.id, id), enabled });
  const eligibilityQuery = useQuery({
    queryKey: ['eligibility', user?.id, id],
    queryFn: () => api.eligibility(user!.id, id),
    enabled,
  });
  const fineQuery = useQuery({
    queryKey: ['fine-estimate', user?.id, id],
    queryFn: () => api.estimateFine(user!.id, id),
    enabled,
  });
  const historyQuery = useQuery({
    queryKey: ['renewal-history', user?.id, id],
    queryFn: () => api.renewalHistory(user!.id, id),
    enabled,
  });

  const renew = useMutation({
    mutationFn: () => api.renew(user!.id, id),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries();
      if (result.ok) {
        Alert.alert('Renewed', `New due date: ${formatDate(result.loan.dueAt)}.`);
      } else {
        Alert.alert('Renewal not completed', result.result.reason);
      }
    },
    onError: (e: Error) => Alert.alert('Could not renew', e.message),
  });

  const giveBack = useMutation({
    mutationFn: () => api.returnLoan(user!.id, id),
    onSuccess: async ({ fine }) => {
      await queryClient.invalidateQueries();
      Alert.alert(
        'Book returned',
        fine
          ? `${formatRupees(fine.amount)} was added to your fine ledger. The loan now shows under My Books → Returned.`
          : 'It now shows under My Books → Returned.',
      );
    },
    onError: (e: Error) => Alert.alert('Could not return', e.message),
  });

  if (loanQuery.isLoading || eligibilityQuery.isLoading || catalogue.isLoading) return <LoadingBlock />;
  const failed = loanQuery.isError ? loanQuery : eligibilityQuery.isError ? eligibilityQuery : null;
  if (failed) {
    return <ErrorBlock message={(failed.error as Error).message} onRetry={() => failed.refetch()} />;
  }
  if (!user || !loanQuery.data || !eligibilityQuery.data) return null;

  const loan = loanQuery.data;
  const eligibility = eligibilityQuery.data;
  const book = catalogue.getBook(loan.bookId);
  if (!book) return <ErrorBlock message="This book is missing from the catalogue." onRetry={() => catalogue.refetch()} />;

  const returned = loan.status === 'RETURNED';
  const days = daysRemaining(loan.dueAt);
  const urgency = urgencyTone(days, colors);
  const elig = eligibilityTone(eligibility, colors);
  const estimate = fineQuery.data;
  const estimated = !returned && estimate ? estimate.estimatedAmount : 0;
  const ctx = eligibility.academicContext;

  function confirmRenew() {
    const until = eligibility.projectedDueAt ? ` until ${formatDate(eligibility.projectedDueAt)}` : '';
    Alert.alert('Renew this book?', `The loan will be extended${until}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Renew', onPress: () => renew.mutate() },
    ]);
  }

  function confirmReturn() {
    Alert.alert(
      'Return this book?',
      estimated > 0
        ? `It is overdue: ${formatRupees(estimated)} will be recorded in your fine ledger.`
        : 'The loan will move to your returned list.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Return', onPress: () => giveBack.mutate() },
      ],
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.header, { backgroundColor: coverColor(book.category + book.id) }]}>
        <BookCover title={book.title} seed={book.id + book.title} size={70} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.headerTitle}>{book.title}</Text>
          <Text style={styles.headerSub}>{book.author}</Text>
          <Text style={styles.headerSub}>{book.category}</Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        {returned ? (
          <Badge label="Returned" fg={colors.success} bg={colors.successMuted} />
        ) : (
          <>
            <Badge label={urgencyLabel(days)} fg={urgency.fg} bg={urgency.bg} />
            <Badge label={elig.label} fg={elig.fg} bg={elig.bg} />
            {loan.markedForReturn ? <Badge label="Marked for return" fg={colors.info} bg={colors.infoMuted} /> : null}
          </>
        )}
      </View>

      <Card>
        <Row label="Issued" value={formatDate(loan.issuedAt)} />
        <Row label="Due" value={formatDate(loan.dueAt)} />
        {returned && loan.returnedAt ? <Row label="Returned" value={formatDate(loan.returnedAt)} /> : null}
        <Row label="Renewals used" value={`${loan.renewalCount} / ${eligibility.maxRenewals ?? policy.maxRenewals}`} />
        <Row label="Copy" value={loan.copyId} />
        <Row label="ISBN" value={book.isbn} />
      </Card>

      {!returned && ctx ? (
        <Card style={{ backgroundColor: colors.infoMuted, borderWidth: 0 }}>
          <AppText variant="bodyStrong" style={{ color: colors.info }}>
            Your academic plan
          </AppText>
          <AppText variant="caption">{describeAcademicContext(ctx)}</AppText>
        </Card>
      ) : null}

      {!returned ? (
        <Card style={{ backgroundColor: eligibility.eligible ? colors.accentMuted : colors.pinkMuted, borderWidth: 0 }}>
          <AppText variant="bodyStrong" style={{ color: eligibility.eligible ? colors.accent : colors.pink }}>
            {eligibility.eligible ? 'You can renew this book' : 'Renewal not possible'}
          </AppText>
          <AppText variant="caption">{eligibility.reason}</AppText>
          {eligibility.projectedDueAt ? (
            <AppText variant="caption">Renewing moves the due date to {formatDate(eligibility.projectedDueAt)}.</AppText>
          ) : null}
        </Card>
      ) : null}

      {estimate && !returned && estimate.estimatedAmount > 0 ? (
        <Card style={{ borderColor: colors.warning }}>
          <AppText variant="bodyStrong" style={{ color: colors.warning }}>
            Estimated fine if returned today: {formatRupees(estimate.estimatedAmount)}
          </AppText>
          <AppText variant="caption">{estimate.calculation}. Not owed until the book is returned.</AppText>
        </Card>
      ) : null}
      {estimate && estimate.recordedAmount > 0 ? (
        <Card style={{ borderColor: colors.danger }}>
          <AppText variant="bodyStrong" style={{ color: colors.danger }}>
            Recorded in your fine ledger: {formatRupees(estimate.recordedAmount)}
          </AppText>
        </Card>
      ) : null}

      <AppText variant="body">{book.description}</AppText>
      <View style={styles.badgeRow}>
        {book.topicIds.map((t) => (
          <Badge key={t} label={catalogue.topicName(t)} fg={colors.info} bg={colors.infoMuted} />
        ))}
      </View>

      {returned ? (
        <PrimaryButton label="View in library / borrow again" onPress={() => router.push(`/catalogue/${book.id}`)} />
      ) : (
        <>
          <PrimaryButton
            label={renew.isPending ? 'Working…' : 'Renew book'}
            onPress={confirmRenew}
            disabled={!eligibility.eligible || loan.markedForReturn || renew.isPending}
          />
          <PrimaryButton
            label={giveBack.isPending ? 'Returning…' : 'Return book'}
            tone="success"
            onPress={confirmReturn}
            disabled={giveBack.isPending}
          />
          <PrimaryButton label="Still need this book?" tone="neutral" onPress={() => router.push(`/decision/${loan.id}`)} />
          <PrimaryButton
            label="Find alternative resources"
            tone="neutral"
            onPress={() => router.push(`/alternatives/${book.id}`)}
          />
        </>
      )}

      <AppText variant="heading">Renewal history</AppText>
      {(historyQuery.data ?? []).length === 0 ? (
        <AppText variant="caption">No renewal attempts on this loan.</AppText>
      ) : (
        (historyQuery.data ?? []).map((item) => (
          <Card key={item.id} style={{ gap: 2 }}>
            <AppText variant="bodyStrong" style={{ color: item.eligible ? colors.success : colors.danger }}>
              {item.eligible ? 'Renewed' : 'Renewal blocked'}
            </AppText>
            <AppText variant="caption">{item.reason}</AppText>
            <AppText variant="label" style={{ color: colors.textMuted }}>
              {formatDate(item.at)}
            </AppText>
          </Card>
        ))
      )}
      <DemoBanner />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', lineHeight: 25 },
  headerSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
}));
