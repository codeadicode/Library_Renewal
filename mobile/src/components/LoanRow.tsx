import { Pressable, View } from 'react-native';

import { evaluateEligibility, PublicStudent } from '../api/mockStore';
import { daysRemaining, eligibilityTone, formatDate, urgencyLabel, urgencyTone } from '../domain/loanDisplay';
import { Book, Loan } from '../domain/types';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/tokens';
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
  const styles = useStyles();
  const { colors } = useTheme();
  const returned = loan.status === 'RETURNED';
  const days = daysRemaining(loan.dueAt);
  const urgency = urgencyTone(days, colors);
  const elig = eligibilityTone(evaluateEligibility(loan, student), colors);
  const stripe = returned ? colors.success : urgency.fg;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.stripe, { backgroundColor: stripe }]} />
      <BookCover title={book.title} seed={book.category + book.id} />
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {book.title}
        </AppText>
        <AppText variant="caption">{book.author}</AppText>
        <AppText variant="caption">
          Issued {formatDate(loan.issuedAt)} ·{' '}
          {returned && loan.returnedAt ? `Returned ${formatDate(loan.returnedAt)}` : `Due ${formatDate(loan.dueAt)}`}
        </AppText>
        <View style={styles.badges}>
          {returned ? (
            <Badge label="Returned" fg={colors.success} bg={colors.successMuted} />
          ) : (
            <>
              <Badge label={urgencyLabel(days)} fg={urgency.fg} bg={urgency.bg} />
              <Badge label={elig.label} fg={elig.fg} bg={elig.bg} />
              {loan.markedForReturn ? (
                <Badge label="Marked for return" fg={colors.info} bg={colors.infoMuted} />
              ) : null}
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    paddingLeft: spacing.md + 4,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 4,
  },
}));
