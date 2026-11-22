import { differenceInCalendarDays, format, parseISO } from 'date-fns';

import { colors } from '../theme/tokens';
import { EligibilityResult, Loan, NOW } from './types';

export function daysRemaining(dueAt: string, now: Date = NOW): number {
  return differenceInCalendarDays(parseISO(dueAt), now);
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'd MMM yyyy');
}

export function urgencyLabel(days: number): string {
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due in 1 day';
  return `Due in ${days} days`;
}

export function urgencyTone(days: number): { bg: string; fg: string } {
  if (days < 0) return { bg: colors.dangerMuted, fg: colors.danger };
  if (days <= 3) return { bg: colors.warningMuted, fg: colors.warning };
  return { bg: colors.successMuted, fg: colors.success };
}

export function eligibilityTone(result: EligibilityResult): { bg: string; fg: string; label: string } {
  if (result.eligible) {
    return { bg: colors.successMuted, fg: colors.success, label: 'Renewal available' };
  }
  return { bg: colors.dangerMuted, fg: colors.danger, label: 'Renewal unavailable' };
}

export function loanNeedsAction(loan: Loan, result: EligibilityResult, now: Date = NOW): boolean {
  if (loan.status !== 'ACTIVE' || loan.markedForReturn) return false;
  const days = daysRemaining(loan.dueAt, now);
  return days <= 7 || !result.eligible && days <= 14;
}
