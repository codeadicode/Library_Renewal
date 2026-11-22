import { differenceInCalendarDays } from 'date-fns';
import { DataStore } from '../repositories/interfaces';
import { FineLedger } from '../types';
import { now } from '../lib/clock';
import { forbidden, notFound } from '../lib/errors';
import { formatRupees, multiplyMoney, sumMoney } from '../lib/money';

export interface FineEstimate {
  loanId: string;
  bookId: string;
  bookTitle: string;
  daysOverdue: number;
  estimatedFine: number;
}

export interface FineSummary {
  currency: 'INR';
  dailyRate: number;
  /** Charges actually recorded in the fine ledger (owed). */
  ledger: { total: number; entries: FineLedger[] };
  /**
   * What open overdue loans *would* cost if returned today. Not owed yet and
   * never added to the ledger total.
   */
  estimates: { total: number; loans: FineEstimate[] };

  /** @deprecated use ledger.total */
  currentBalance: number;
  /** @deprecated use ledger.entries */
  fineHistory: FineLedger[];
  /** @deprecated use estimates.loans */
  activeOverdueFines: Array<{ loanId: string; daysOverdue: number; estimatedFine: number }>;
}

export class FineService {
  constructor(private store: DataStore) {}

  public async getUserFines(userId: string): Promise<FineSummary> {
    const { repos } = this.store;
    const [entries, loans, policy] = await Promise.all([
      repos.fines.findByUserId(userId),
      repos.loans.findByUserId(userId),
      repos.policy.getDefaultPolicy(),
    ]);

    const at = now();
    const estimates: FineEstimate[] = [];
    for (const loan of loans) {
      if (loan.status === 'RETURNED') continue;
      const daysOverdue = differenceInCalendarDays(at, new Date(loan.dueAt));
      if (daysOverdue <= 0) continue;
      const book = await repos.books.findById(loan.bookId);
      estimates.push({
        loanId: loan.id,
        bookId: loan.bookId,
        bookTitle: book?.title ?? 'Unknown title',
        daysOverdue,
        estimatedFine: multiplyMoney(policy.finePerDay, daysOverdue),
      });
    }

    const ledgerTotal = sumMoney(entries.map((e) => e.amount));
    return {
      currency: 'INR',
      dailyRate: policy.finePerDay,
      ledger: { total: ledgerTotal, entries },
      estimates: { total: sumMoney(estimates.map((e) => e.estimatedFine)), loans: estimates },
      currentBalance: ledgerTotal,
      fineHistory: entries,
      activeOverdueFines: estimates.map(({ loanId, daysOverdue, estimatedFine }) => ({ loanId, daysOverdue, estimatedFine })),
    };
  }

  /** Estimate for one of *the caller's own* loans. */
  public async estimateLateFine(
    loanId: string,
    userId: string,
    returnDate: Date = now(),
  ): Promise<{
    loanId: string;
    daysLate: number;
    estimatedAmount: number;
    dailyRate: number;
    returned: boolean;
    recordedAmount: number;
    calculation: string;
  }> {
    const { repos } = this.store;
    const loan = await repos.loans.findById(loanId);
    if (!loan) throw notFound('Loan not found');
    if (loan.userId !== userId) throw forbidden('Forbidden: You do not own this loan');

    const [policy, recorded] = await Promise.all([repos.policy.getDefaultPolicy(), repos.fines.findByLoanId(loanId)]);
    const recordedAmount = sumMoney(recorded.map((f) => f.amount));

    if (loan.status === 'RETURNED') {
      return {
        loanId,
        daysLate: 0,
        estimatedAmount: 0,
        dailyRate: policy.finePerDay,
        returned: true,
        recordedAmount,
        calculation: recordedAmount > 0
          ? `Returned. ${formatRupees(recordedAmount)} is recorded in the fine ledger.`
          : 'Returned on time. Nothing is owed.',
      };
    }

    const daysLate = Math.max(0, differenceInCalendarDays(returnDate, new Date(loan.dueAt)));
    const estimatedAmount = multiplyMoney(policy.finePerDay, daysLate);
    return {
      loanId,
      daysLate,
      estimatedAmount,
      dailyRate: policy.finePerDay,
      returned: false,
      recordedAmount,
      calculation: `${daysLate} overdue day${daysLate === 1 ? '' : 's'} × ${formatRupees(policy.finePerDay)}/day = ${formatRupees(estimatedAmount)} (estimate)`,
    };
  }
}
