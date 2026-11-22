import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';

import { availablePhysicalCount, mockApi } from '@/src/api/mockStore';
import { useAuth } from '@/src/auth/AuthContext';
import { AppText, Badge, BookCover, Chip, EmptyState, ErrorBlock, LoadingBlock, SearchBox } from '@/src/components/ui';
import { Book } from '@/src/domain/types';
import { makeStyles, useTheme } from '@/src/theme/ThemeContext';
import { coverColor, radius, spacing } from '@/src/theme/tokens';

type Avail = 'ANY' | 'NOW' | 'UNAVAILABLE';
type Kind = 'ANY' | 'PHYSICAL' | 'DIGITAL';

export default function LibraryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles();
  const [q, setQ] = useState('');
  const [avail, setAvail] = useState<Avail>('NOW');
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
  const loansQuery = useQuery({
    queryKey: ['loans', user?.id],
    queryFn: () => mockApi.listLoans(user!.id),
    enabled: Boolean(user),
  });
  const issued = new Set(
    (loansQuery.data ?? []).filter((l) => l.status === 'ACTIVE').map((l) => l.bookId),
  );

  const total = mockApi.books.length;
  const availableNow = mockApi.books.filter((b) => availablePhysicalCount(b.id) > 0 || b.digitalUrl).length;
  const categories = [...new Set(mockApi.books.map((b) => b.category))];

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
      <View style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryValue}>{availableNow}</Text>
          <Text style={styles.summaryLabel}>titles available now</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryValue}>{total}</Text>
          <Text style={styles.summaryLabel}>titles in the catalogue</Text>
        </View>
      </View>
      <SearchBox value={q} onChangeText={setQ} placeholder="Search title, author, ISBN, topic" />
      <View style={styles.chips}>
        <Chip label="Available now" selected={avail === 'NOW'} onPress={() => setAvail('NOW')} color={colors.success} />
        <Chip label="All books" selected={avail === 'ANY'} onPress={() => setAvail('ANY')} />
        <Chip
          label="Checked out"
          selected={avail === 'UNAVAILABLE'}
          onPress={() => setAvail('UNAVAILABLE')}
          color={colors.danger}
        />
        <Chip
          label="Physical"
          selected={kind === 'PHYSICAL'}
          onPress={() => setKind(kind === 'PHYSICAL' ? 'ANY' : 'PHYSICAL')}
          color={colors.info}
        />
        <Chip
          label="Digital"
          selected={kind === 'DIGITAL'}
          onPress={() => setKind(kind === 'DIGITAL' ? 'ANY' : 'DIGITAL')}
          color={colors.info}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {categories.map((cat) => (
          <Chip
            key={cat}
            label={cat}
            selected={category === cat}
            onPress={() => setCategory(category === cat ? undefined : cat)}
            color={coverColor(cat)}
          />
        ))}
      </ScrollView>
      <AppText variant="caption">
        {booksQuery.data ? `${booksQuery.data.length} result${booksQuery.data.length === 1 ? '' : 's'}` : ' '}
      </AppText>
    </View>
  );

  if (booksQuery.isError) {
    return <ErrorBlock message={(booksQuery.error as Error).message} onRetry={() => booksQuery.refetch()} />;
  }

  return (
    <FlatList
      style={styles.screen}
      data={booksQuery.data ?? []}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={{ gap: spacing.md }}
      contentContainerStyle={styles.content}
      ListHeaderComponent={header}
      ListEmptyComponent={
        booksQuery.isLoading ? <LoadingBlock /> : <EmptyState title="No books found" body="Try a different search or filter." />
      }
      renderItem={({ item }) => (
        <BookTile book={item} issued={issued.has(item.id)} onPress={() => router.push(`/catalogue/${item.id}`)} />
      )}
    />
  );
}

function BookTile({ book, issued, onPress }: { book: Book; issued: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const copies = availablePhysicalCount(book.id);
  const status = issued
    ? { label: 'Issued to you', fg: colors.accent, bg: colors.accentMuted }
    : copies > 0
      ? { label: `${copies} available`, fg: colors.success, bg: colors.successMuted }
      : book.digitalUrl
        ? { label: 'Digital copy', fg: colors.info, bg: colors.infoMuted }
        : { label: 'Checked out', fg: colors.danger, bg: colors.dangerMuted };

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.tileTop, { backgroundColor: coverColor(book.category + book.id) }]}>
        <BookCover title={book.title} seed={book.category + book.id + 'x'} size={52} />
      </View>
      <View style={{ padding: spacing.md, gap: 4, flex: 1 }}>
        <AppText variant="bodyStrong" numberOfLines={2} style={{ fontSize: 14, lineHeight: 19 }}>
          {book.title}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {book.author}
        </AppText>
        <AppText variant="label" style={{ color: colors.textMuted }} numberOfLines={1}>
          {book.category.toUpperCase()}
        </AppText>
        <View style={{ marginTop: 'auto', paddingTop: 4 }}>
          <Badge label={status.label} fg={status.fg} bg={status.bg} />
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.hero,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  summaryValue: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', lineHeight: 36 },
  summaryLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
  summaryDivider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.3)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flex: 1,
    maxWidth: '48.5%',
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  tileTop: { height: 96, alignItems: 'center', justifyContent: 'center', opacity: 0.95 },
}));
