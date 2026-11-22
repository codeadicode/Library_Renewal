import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import { api } from '@/src/api';
import { useActionCentre, useCatalogue, usePolicy } from '@/src/api/hooks';
import { useAuth } from '@/src/auth/AuthContext';
import { LoanRow } from '@/src/components/LoanRow';
import { AppText, EmptyState, ErrorBlock, LoadingBlock, SearchBox, Segmented } from '@/src/components/ui';
import { filterLoans, loanMatchesFilter } from '@/src/domain/loanDisplay';
import { BookFilter } from '@/src/domain/types';
import { makeStyles, useTheme } from '@/src/theme/ThemeContext';
import { spacing } from '@/src/theme/tokens';

const FILTER_IDS: BookFilter[] = ['ISSUED', 'DUE_SOON', 'OVERDUE', 'RETURNED'];

const EMPTY: Record<BookFilter, { title: string; body: string }> = {
  ISSUED: { title: 'No books issued', body: 'Borrow something from the Library tab.' },
  DUE_SOON: { title: 'Nothing due soon', body: 'No issued book is due in the next 7 days.' },
  OVERDUE: { title: 'No overdue books', body: 'You have no overdue books.' },
  RETURNED: { title: 'No returns yet', body: 'Books you return will appear here.' },
};

export default function BooksScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<BookFilter>('ISSUED');
  const [q, setQ] = useState('');

  useEffect(() => {
    if (params.filter && FILTER_IDS.includes(params.filter as BookFilter)) {
      setFilter(params.filter as BookFilter);
    }
  }, [params.filter]);

  const policy = usePolicy();
  const catalogue = useCatalogue();
  const actions = useActionCentre();
  const loansQuery = useQuery({
    queryKey: ['loans', user?.id],
    queryFn: () => api.listLoans(user!.id),
    enabled: Boolean(user),
  });

  const all = loansQuery.data ?? [];
  const dueSoonDays = policy.approachingMaxDays;
  const rows = useMemo(
    () => filterLoans(all, filter, q, catalogue.getBook, dueSoonDays),
    [all, filter, q, catalogue.getBook, dueSoonDays],
  );

  if (loansQuery.isLoading || catalogue.isLoading) return <LoadingBlock />;
  if (loansQuery.isError) {
    return <ErrorBlock message={(loansQuery.error as Error).message} onRetry={() => loansQuery.refetch()} />;
  }
  if (!user) return null;

  const count = (f: BookFilter) => all.filter((l) => loanMatchesFilter(l, f, dueSoonDays)).length;
  const eligibilityByLoan = actions.data?.eligibilityByLoan ?? {};
  const options = [
    { id: 'ISSUED' as const, label: 'Issued', count: count('ISSUED'), color: colors.accent },
    { id: 'DUE_SOON' as const, label: 'Due', count: count('DUE_SOON'), color: colors.warning },
    { id: 'OVERDUE' as const, label: 'Overdue', count: count('OVERDUE'), color: colors.danger },
    { id: 'RETURNED' as const, label: 'Returned', count: count('RETURNED'), color: colors.success },
  ];

  return (
    <View style={styles.wrap}>
      <Segmented options={options} value={filter} onChange={setFilter} />
      <SearchBox value={q} onChangeText={setQ} placeholder="Search your books by title, author, category" />
      <AppText variant="caption">
        {filter === 'RETURNED'
          ? `${rows.length} returned book${rows.length === 1 ? '' : 's'}, newest first`
          : `${rows.length} book${rows.length === 1 ? '' : 's'}, soonest due first`}
      </AppText>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xxl }}
        ListEmptyComponent={<EmptyState {...EMPTY[filter]} />}
        renderItem={({ item }) => {
          const book = catalogue.getBook(item.bookId);
          if (!book) return null;
          return (
            <LoanRow
              loan={item}
              book={book}
              eligibility={eligibilityByLoan[item.id]}
              onPress={() => router.push(`/book/${item.id}`)}
            />
          );
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: c.background,
  },
}));
