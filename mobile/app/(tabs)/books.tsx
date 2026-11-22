import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { getBook, mockApi } from '@/src/api/mockStore';
import { useAuth } from '@/src/auth/AuthContext';
import { LoanRow } from '@/src/components/LoanRow';
import { Chip, EmptyState, ErrorBlock, LoadingBlock } from '@/src/components/ui';
import { BookFilter } from '@/src/domain/types';
import { colors, radius, spacing } from '@/src/theme/tokens';

const FILTERS: { id: BookFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'DUE_SOON', label: 'Due soon' },
  { id: 'OVERDUE', label: 'Overdue' },
  { id: 'RENEWAL_AVAILABLE', label: 'Renewal available' },
  { id: 'RENEWAL_UNAVAILABLE', label: 'Renewal unavailable' },
];

export default function BooksScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<BookFilter>('ALL');
  const [q, setQ] = useState('');
  const loansQuery = useQuery({
    queryKey: ['loans', user?.id],
    queryFn: () => mockApi.listLoans(user!.id),
    enabled: Boolean(user),
  });

  const rows = useMemo(() => {
    if (!user || !loansQuery.data) return [];
    return mockApi.filterLoans(loansQuery.data, user, filter, q);
  }, [filter, loansQuery.data, q, user]);

  if (loansQuery.isLoading) return <LoadingBlock />;
  if (loansQuery.isError) {
    return <ErrorBlock message={(loansQuery.error as Error).message} onRetry={() => loansQuery.refetch()} />;
  }
  if (!user) return null;

  return (
    <View style={styles.wrap}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search title, author, category"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
      />
      <View style={styles.chips}>
        {FILTERS.map((item) => (
          <Chip key={item.id} label={item.label} selected={filter === item.id} onPress={() => setFilter(item.id)} />
        ))}
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xxl }}
        ListEmptyComponent={
          <EmptyState title="No matching loans" body="Try another filter or search. Only active simulated loans are listed." />
        }
        renderItem={({ item }) => {
          const book = getBook(item.bookId);
          if (!book) return null;
          return (
            <LoanRow
              loan={item}
              book={book}
              student={user}
              onPress={() => router.push(`/book/${item.id}`)}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  search: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
