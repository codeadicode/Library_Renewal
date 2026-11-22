import { Pressable, StyleSheet, View } from 'react-native';

import { evaluateEligibility } from '../api/mockStore';
import { daysRemaining, eligibilityTone, formatDate, urgencyLabel, urgencyTone } from '../domain/loanDisplay';
import { PublicStudent } from '../api/mockStore';
import { Book, Loan } from '../domain/types';
import { colors, radius, spacing } from '../theme/tokens';
import { AppText, Badge, BookCover } from './ui';

export function LoanRow({
  loan,
  book,
  student,
  onPress,
}: {
  loan: Loan;
  book: Book;
  student: PublicStudent;
  onPress: () => void;
}) {
  const days = daysRemaining(loan.dueAt);
  const urgency = urgencyTone(days);
  const eligibility = evaluateEligibility(loan, student);
  const elig = eligibilityTone(eligibility);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}>
      <BookCover title={book.title} />
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {book.title}
        </AppText>
        <AppText variant="caption">{book.author}</AppText>
        <AppText variant="caption">
          {book.category} · Due {formatDate(loan.dueAt)}
        </AppText>
        <View style={styles.badges}>
          <Badge label={urgencyLabel(days)} fg={urgency.fg} bg={urgency.bg} />
          <Badge label={elig.label} fg={elig.fg} bg={elig.bg} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 4,
  },
});
