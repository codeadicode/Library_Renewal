import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { api } from '@/src/api';
import { useCatalogue } from '@/src/api/hooks';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Badge, BookCover, DemoBanner, EmptyState, ErrorBlock, LoadingBlock } from '@/src/components/ui';
import { makeStyles, useTheme } from '@/src/theme/ThemeContext';
import { radius, spacing } from '@/src/theme/tokens';

export default function AlternativesScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const catalogue = useCatalogue();
  const source = bookId ? catalogue.getBook(bookId) : undefined;
  const query = useQuery({
    queryKey: ['alternatives', user?.id, bookId],
    queryFn: () => api.alternatives(user!.id, bookId),
    enabled: Boolean(user && bookId),
  });

  if (query.isLoading) return <LoadingBlock />;
  if (query.isError) {
    return <ErrorBlock message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AppText variant="title">Similar books</AppText>
      <AppText variant="caption">
        Alternatives to {source?.title ?? 'this title'}, ranked by topic and course overlap and by your upcoming
        assessments. Books you can get right now are listed first.
      </AppText>
      {(query.data ?? []).length === 0 ? (
        <EmptyState title="No alternatives" body="The demo catalogue has no overlapping topics for this title." />
      ) : (
        (query.data ?? []).map((row) => {
          const book = row.book ?? catalogue.getBook(row.bookId);
          if (!book) return null;
          const accessible = row.availablePhysical > 0 || row.digitalAccessible;
          return (
            <Pressable
              key={row.bookId}
              onPress={() => router.push(`/catalogue/${book.id}`)}
              style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <BookCover title={book.title} seed={book.category + book.id} />
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="bodyStrong">{book.title}</AppText>
                  <AppText variant="caption">{book.author}</AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    <Badge
                      label={
                        row.availablePhysical > 0
                          ? `${row.availablePhysical} available`
                          : row.digitalAccessible
                            ? 'Digital copy'
                            : 'Checked out'
                      }
                      fg={accessible ? colors.success : colors.danger}
                      bg={accessible ? colors.successMuted : colors.dangerMuted}
                    />
                    <Badge label={`${Math.round(row.score * 100)}% match`} fg={colors.accent} bg={colors.accentMuted} />
                  </View>
                </View>
              </View>
              <AppText variant="label" style={{ color: colors.pink }}>
                WHY THIS BOOK
              </AppText>
              {row.reasons.map((reason) => (
                <AppText key={reason} variant="caption">
                  • {reason}
                </AppText>
              ))}
            </Pressable>
          );
        })
      )}
      <DemoBanner />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    gap: spacing.sm,
  },
}));
