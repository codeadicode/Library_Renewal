import { differenceInCalendarDays } from 'date-fns';
import { Loan } from '../types';
import { now } from './clock';

/**
 * Loans are stored as ACTIVE or RETURNED. Whether an open loan is OVERDUE is a
 * function of its due date and the clock, so it is derived on every read
 * instead of being written once and going stale (the old "status mismatch").
 */
export function withDerivedStatus<T extends Loan>(loan: T, at: Date = now()): T {
  if (loan.returnedAt || loan.status === 'RETURNED') return { ...loan, status: 'RETURNED' };
  const overdue = differenceInCalendarDays(new Date(loan.dueAt), at) < 0;
  return { ...loan, status: overdue ? 'OVERDUE' : 'ACTIVE' };
}

export function isOpenLoan(loan: Pick<Loan, 'status' | 'returnedAt'>): boolean {
  return loan.status !== 'RETURNED' && !loan.returnedAt;
}

/** Never persist the derived OVERDUE value. */
export function storedStatus(status: Loan['status'] | undefined): 'ACTIVE' | 'RETURNED' | undefined {
  if (status === undefined) return undefined;
  return status === 'RETURNED' ? 'RETURNED' : 'ACTIVE';
}
