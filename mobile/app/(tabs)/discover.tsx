import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { availablePhysicalCount, mockApi } from '@/src/api/mockStore';
import { AppText, Badge, BookCover, Chip, EmptyState, ErrorBlock, LoadingBlock } from '@/src/components/ui';
import { colors, radius, spacing } from '@/src/theme/tokens';

type Avail = 'ANY' | 'NOW' | 'UNAVAILABLE';
type Kind = 'ANY' | 'PHYSICAL' | 'DIGITAL';

export default function DiscoverScreen() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [avail, setAvail] = useState<Avail>('ANY');
  const [kind, setKind] = useState<Kind>('ANY');
  const [category, setCategory] = useState<string | undefined>();

  const booksQuery = useQuery({
    queryKey: ['books', q, avail, kind, category],
    queryFn: () =>
      mockApi.listBooks({
        q,
        available: avail === 'ANY' ? undefined : avail === 'NOW',
        type: kind === 'ANY' ? undefined : kind,
        category,
      }),
  });

  const categories = [...new Set(mockApi.books.map((b) => b.category))];

  return (
    <View style={styles.wrap}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Title, author, ISBN, subject, topic"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
      />
      <View style={styles.chips}>
        <Chip label="Any availability" selected={avail === 'ANY'} onPress={() => setAvail('ANY')} />
        <Chip label="Available now" selected={avail === 'NOW'} onPress={() => setAvail('NOW')} />
        <Chip label="Unavailable" selected={avail === 'UNAVAILABLE'} onPress={() => setAvail('UNAVAILABLE')} />
        <Chip label="Physical" selected={kind === 'PHYSICAL'} onPress={() => setKind(kind === 'PHYSICAL' ? 'ANY' : 'PHYSICAL')} />
        <Chip label="Digital" selected={kind === 'DIGITAL'} onPress={() => setKind(kind === 'DIGITAL' ? 'ANY' : 'DIGITAL')} />
        {categories.map((c) => (
          <Chip
            key={c}
            label={c}
            selected={category === c}
            onPress={() => setCategory(category === c ? undefined : c)}
          />
        ))}
      </View>
      {booksQuery.isLoading ? <LoadingBlock /> : null}
      {booksQuery.isError ? (
        <ErrorBlock message={(booksQuery.error as Error).message} onRetry={() => booksQuery.refetch()} />
      ) : (
        <FlatList
          data={booksQuery.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xxl }}
          ListEmptyComponent={<EmptyState title="No titles" body="No catalogue rows match these filters." />}
          renderItem={({ item }) => {
            const copies = availablePhysicalCount(item.id);
            const accessible = copies > 0 || Boolean(item.digitalUrl);
            return (
              <Pressable
                onPress={() => router.push(`/catalogue/${item.id}`)}
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}>
                <BookCover title={item.title} />
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="bodyStrong">{item.title}</AppText>
                  <AppText variant="caption">{item.author}</AppText>
                  <AppText variant="caption">
                    {item.category} · {item.resourceType.toLowerCase()}
                  </AppText>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                    <Badge
                      label={
                        copies > 0
                          ? `${copies} copy available`
                          : item.digitalUrl
                            ? 'Digital demo record'
                            : 'No accessible copy'
                      }
                      fg={accessible ? colors.success : colors.danger}
                      bg={accessible ? colors.successMuted : colors.dangerMuted}
                    />
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  search: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
