import { differenceInCalendarDays, format, parseISO } from 'date-fns';

import { now } from '../config';
import { Palette } from '../theme/tokens';
import { Book, BookFilter, EligibilityResult, Loan } from './types';

export function daysRemaining(dueAt: string, at: Date = now()): number {
  return differenceInCalendarDays(parseISO(dueAt), at);
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'd MMM yyyy');
}

/** ACTIVE and OVERDUE are both open loans; only RETURNED is closed. */
export function isOpenLoan(loan: Pick<Loan, 'status'>): boolean {
  return loan.status !== 'RETURNED';
}

export function urgencyLabel(days: number): string {
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due in 1 day';
  return `Due in ${days} days`;
}

export function urgencyTone(days: number, c: Palette): { bg: string; fg: string } {
  if (days < 0) return { bg: c.dangerMuted, fg: c.danger };
  if (days <= 3) return { bg: c.warningMuted, fg: c.warning };
  return { bg: c.successMuted, fg: c.success };
}

export function eligibilityTone(result: EligibilityResult, c: Palette): { bg: string; fg: string; label: string } {
  if (result.eligible) {
    return { bg: c.accentMuted, fg: c.accent, label: 'Renewal available' };
  }
  return { bg: c.pinkMuted, fg: c.pink, label: 'Renewal unavailable' };
}

export function formatRupees(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

export function loanMatchesFilter(loan: Loan, filter: BookFilter, dueSoonDays: number, at: Date = now()): boolean {
  const days = daysRemaining(loan.dueAt, at);
  switch (filter) {
    case 'ISSUED':
      return isOpenLoan(loan);
    case 'DUE_SOON':
      return isOpenLoan(loan) && days >= 0 && days <= dueSoonDays;
    case 'OVERDUE':
      return isOpenLoan(loan) && days < 0;
    case 'RETURNED':
      return loan.status === 'RETURNED';
    default:
      return true;
  }
}

export function filterLoans(
  loans: Loan[],
  filter: BookFilter,
  q: string,
  getBook: (id: string) => Book | undefined,
  dueSoonDays: number,
): Loan[] {
  const query = q.trim().toLowerCase();
  return loans
    .filter((loan) => loanMatchesFilter(loan, filter, dueSoonDays))
    .filter((loan) => {
      if (!query) return true;
      const book = getBook(loan.bookId);
      const hay = `${book?.title ?? ''} ${book?.author ?? ''} ${book?.category ?? ''}`.toLowerCase();
      return hay.includes(query);
    })
    .sort((a, b) =>
      filter === 'RETURNED'
        ? (b.returnedAt ?? '').localeCompare(a.returnedAt ?? '')
        : a.dueAt.localeCompare(b.dueAt),
    );
}

export function describeAcademicContext(ctx: NonNullable<EligibilityResult['academicContext']>): string {
  const when = format(parseISO(ctx.assessmentDate), 'd MMM');
  const until = format(parseISO(ctx.neededUntil), 'd MMM');
  const base = `Needed for your ${ctx.topic} ${ctx.assessmentType.toLowerCase()} on ${when}`;
  if (!ctx.neededBeyondDue) return `${base}. The current due date already covers it.`;
  if (ctx.renewalCoversNeed === true) return `${base} (until ${until}). One renewal covers it.`;
  if (ctx.renewalCoversNeed === false) return `${base} (until ${until}). Even a renewal ends earlier — line up an alternative.`;
  return `${base} (until ${until}), after the due date.`;
}
