import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getBook, mockApi } from '@/src/api/mockStore';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Badge, BookCover, DemoBanner, EmptyState, ErrorBlock, LoadingBlock } from '@/src/components/ui';
import { colors, radius, spacing } from '@/src/theme/tokens';

export default function AlternativesScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const source = bookId ? getBook(bookId) : undefined;
  const query = useQuery({
    queryKey: ['alternatives', user?.id, bookId],
    queryFn: () => mockApi.alternatives(user!.id, bookId),
    enabled: Boolean(user && bookId),
  });

  if (query.isLoading) return <LoadingBlock />;
  if (query.isError) {
    return <ErrorBlock message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <DemoBanner />
      <AppText variant="title">Related resources</AppText>
      <AppText variant="caption">
        Alternatives to {source?.title ?? 'this title'}. Ranking in Phase 1 uses topic/course overlap only
        (metadata stand-in). TF-IDF and embeddings are not implemented yet.
      </AppText>
      {(query.data ?? []).length === 0 ? (
        <EmptyState title="No alternatives" body="The demo catalogue has no overlapping topics for this title." />
      ) : (
        (query.data ?? []).map((row) => {
          const book = getBook(row.bookId);
          if (!book) return null;
          const accessible = row.availablePhysical > 0 || row.digitalAccessible;
          return (
            <Pressable
              key={row.bookId}
              onPress={() => router.push(`/catalogue/${book.id}`)}
              style={styles.card}>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <BookCover title={book.title} />
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="bodyStrong">{book.title}</AppText>
                  <AppText variant="caption">{book.author}</AppText>
                  <Badge
                    label={
                      row.availablePhysical > 0
                        ? `${row.availablePhysical} physical available`
                        : row.digitalAccessible
                          ? 'Digital demo record'
                          : 'Not currently accessible'
                    }
                    fg={accessible ? colors.success : colors.textSecondary}
                    bg={accessible ? colors.successMuted : colors.surfaceMuted}
                  />
                  <AppText variant="label">{book.resourceType}</AppText>
                </View>
              </View>
              <AppText variant="bodyStrong">Why</AppText>
              {row.reasons.map((reason) => (
                <AppText key={reason} variant="caption">
                  · {reason}
                </AppText>
              ))}
              {row.matchingTopics.length > 0 ? (
                <AppText variant="caption">Matching topics: {row.matchingTopics.join(', ')}</AppText>
              ) : null}
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
});
