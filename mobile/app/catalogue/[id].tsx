import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { mockApi } from '@/src/api/mockStore';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Badge, DemoBanner, ErrorBlock, LoadingBlock, PrimaryButton } from '@/src/components/ui';
import { colors, radius, spacing } from '@/src/theme/tokens';

export default function CatalogueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const detailQuery = useQuery({
    queryKey: ['book', id],
    queryFn: () => mockApi.getBookDetail(id),
    enabled: Boolean(id),
  });
  const reserve = useMutation({
    mutationFn: () => mockApi.reserve(user!.id, id),
    onSuccess: () => Alert.alert('Hold placed', 'Simulated reservation only.'),
    onError: (e: Error) => Alert.alert('Could not reserve', e.message),
  });

  if (detailQuery.isLoading) return <LoadingBlock />;
  if (detailQuery.isError) {
    return <ErrorBlock message={(detailQuery.error as Error).message} onRetry={() => detailQuery.refetch()} />;
  }
  if (!detailQuery.data) return null;
  const { book, copies, availablePhysical, topics, courses } = detailQuery.data;
  const accessible = availablePhysical > 0 || Boolean(book.digitalUrl);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <DemoBanner />
      <AppText variant="title">{book.title}</AppText>
      <AppText variant="caption">{book.author}</AppText>
      <AppText variant="caption">ISBN {book.isbn}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Badge
          label={accessible ? 'Accessible in demo catalogue' : 'Not currently accessible'}
          fg={accessible ? colors.success : colors.danger}
          bg={accessible ? colors.successMuted : colors.dangerMuted}
        />
        <Badge label={book.resourceType} fg={colors.accent} bg={colors.accentMuted} />
      </View>
      <AppText variant="body">{book.description}</AppText>
      <AppText variant="bodyStrong">Physical copies</AppText>
      {copies.map((copy) => (
        <View key={copy.id} style={styles.row}>
          <AppText variant="bodyStrong">{copy.code}</AppText>
          <AppText variant="caption">{copy.status.replace('_', ' ')}</AppText>
        </View>
      ))}
      {copies.length === 0 ? <AppText variant="caption">No physical copies (digital-only demo record).</AppText> : null}
      <AppText variant="caption">Topics: {topics.join(', ')}</AppText>
      <AppText variant="caption">Courses: {courses.join('; ')}</AppText>
      {book.digitalUrl ? (
        <AppText variant="caption">Demo digital record: {book.digitalUrl}</AppText>
      ) : null}
      {!accessible ? (
        <PrimaryButton label="View related resources" onPress={() => router.push(`/alternatives/${book.id}`)} />
      ) : (
        <PrimaryButton label="Related resources" tone="neutral" onPress={() => router.push(`/alternatives/${book.id}`)} />
      )}
      {user ? (
        <PrimaryButton
          label={reserve.isPending ? 'Saving…' : 'Place simulated reservation'}
          tone="neutral"
          onPress={() => reserve.mutate()}
          disabled={reserve.isPending}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
