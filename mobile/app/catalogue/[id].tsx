import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, Text, View } from 'react-native';

import { mockApi } from '@/src/api/mockStore';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Badge, BookCover, Card, DemoBanner, ErrorBlock, LoadingBlock, PrimaryButton } from '@/src/components/ui';
import { CopyStatus } from '@/src/domain/types';
import { makeStyles, useTheme } from '@/src/theme/ThemeContext';
import { coverColor, Palette, radius, spacing } from '@/src/theme/tokens';

function copyTone(status: CopyStatus, c: Palette) {
  if (status === 'AVAILABLE') return { fg: c.success, bg: c.successMuted, label: 'Available' };
  if (status === 'RESERVED') return { fg: c.warning, bg: c.warningMuted, label: 'Reserved' };
  return { fg: c.danger, bg: c.dangerMuted, label: 'On loan' };
}

export default function CatalogueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const styles = useStyles();

  const detailQuery = useQuery({
    queryKey: ['book', id],
    queryFn: () => mockApi.getBookDetail(id),
    enabled: Boolean(id),
  });
  const loansQuery = useQuery({
    queryKey: ['loans', user?.id],
    queryFn: () => mockApi.listLoans(user!.id),
    enabled: Boolean(user),
  });
  const reserve = useMutation({
    mutationFn: () => mockApi.reserve(user!.id, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      Alert.alert('Reservation placed', 'You will be next in line for this book (demo).');
    },
    onError: (e: Error) => Alert.alert('Could not reserve', e.message),
  });
  const borrow = useMutation({
    mutationFn: () => mockApi.borrowBook(user!.id, id),
    onSuccess: async (loan) => {
      await queryClient.invalidateQueries();
      Alert.alert('Book issued', `Due back on ${loan.dueAt.slice(0, 10)}. Find it under My Books.`);
    },
    onError: (e: Error) => Alert.alert('Could not borrow', e.message),
  });

  if (detailQuery.isLoading) return <LoadingBlock />;
  if (detailQuery.isError) {
    return <ErrorBlock message={(detailQuery.error as Error).message} onRetry={() => detailQuery.refetch()} />;
  }
  if (!detailQuery.data) return null;
  const { book, copies, availablePhysical, topics, courses } = detailQuery.data;
  const myLoan = (loansQuery.data ?? []).find((l) => l.bookId === book.id && l.status === 'ACTIVE');
  const accessible = availablePhysical > 0 || Boolean(book.digitalUrl);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.header, { backgroundColor: coverColor(book.category + book.id) }]}>
        <BookCover title={book.title} seed={book.id + book.title} size={80} />
        <Text style={styles.headerTitle}>{book.title}</Text>
        <Text style={styles.headerSub}>{book.author}</Text>
        <View style={styles.availPill}>
          <Text style={[styles.availText, { color: accessible ? colors.success : colors.danger }]}>
            {myLoan
              ? 'Issued to you'
              : availablePhysical > 0
                ? `${availablePhysical} of ${copies.length} copies available`
                : book.digitalUrl
                  ? 'Digital copy available'
                  : 'All copies checked out'}
          </Text>
        </View>
      </View>

      {myLoan ? (
        <PrimaryButton label="View my loan" onPress={() => router.push(`/book/${myLoan.id}`)} />
      ) : availablePhysical > 0 ? (
        <PrimaryButton
          label={borrow.isPending ? 'Issuing…' : 'Borrow this book'}
          tone="success"
          onPress={() => borrow.mutate()}
          disabled={borrow.isPending || !user}
        />
      ) : (
        <PrimaryButton
          label={reserve.isPending ? 'Saving…' : 'Reserve (join the queue)'}
          tone="pink"
          onPress={() => reserve.mutate()}
          disabled={reserve.isPending || !user}
        />
      )}

      <Card>
        <AppText variant="bodyStrong">About this book</AppText>
        <AppText variant="body">{book.description}</AppText>
        <View style={styles.badgeRow}>
          <Badge label={book.resourceType} fg={colors.accent} bg={colors.accentMuted} />
          <Badge label={book.academicLevel} fg={colors.pink} bg={colors.pinkMuted} />
          <Badge label={book.renewable ? 'Renewable' : 'Not renewable'} fg={colors.info} bg={colors.infoMuted} />
        </View>
        <AppText variant="caption">ISBN {book.isbn}</AppText>
      </Card>

      <Card>
        <AppText variant="bodyStrong">Copies</AppText>
        {copies.length === 0 ? (
          <AppText variant="caption">No physical copies (digital-only demo record).</AppText>
        ) : (
          copies.map((copy) => {
            const tone = copyTone(copy.status, colors);
            return (
              <View key={copy.id} style={styles.copyRow}>
                <AppText variant="bodyStrong">{copy.code}</AppText>
                <Badge label={tone.label} fg={tone.fg} bg={tone.bg} />
              </View>
            );
          })
        )}
        {book.digitalUrl ? <AppText variant="caption">Digital record: {book.digitalUrl}</AppText> : null}
      </Card>

      <Card>
        <AppText variant="bodyStrong">Topics</AppText>
        <View style={styles.badgeRow}>
          {topics.map((t) => (
            <Badge key={t} label={t} fg={colors.info} bg={colors.infoMuted} />
          ))}
        </View>
        <AppText variant="bodyStrong">Courses</AppText>
        <AppText variant="caption">{courses.join(' · ')}</AppText>
      </Card>

      <PrimaryButton label="Similar books" tone="neutral" onPress={() => router.push(`/alternatives/${book.id}`)} />
      {!myLoan && availablePhysical > 0 ? (
        <PrimaryButton
          label={reserve.isPending ? 'Saving…' : 'Reserve instead'}
          tone="neutral"
          onPress={() => reserve.mutate()}
          disabled={reserve.isPending || !user}
        />
      ) : null}
      <DemoBanner />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 28 },
  headerSub: { color: 'rgba(255,255,255,0.88)', fontSize: 14 },
  availPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginTop: spacing.xs,
  },
  availText: { fontWeight: '800', fontSize: 13 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  copyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
}));
