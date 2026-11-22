import { addDays, formatISO } from 'date-fns';
import {
  IBookRepository,
  ILoanRepository,
  INotificationRepository,
} from '../repositories/interfaces';
import { Loan, NeedDecision } from '../types';

export class LoanService {
  constructor(
    private loanRepo: ILoanRepository,
    private bookRepo: IBookRepository,
    private notificationRepo: INotificationRepository,
  ) {}

  public async getUserLoans(userId: string): Promise<Loan[]> {
    return this.loanRepo.findByUserId(userId);
  }

  public async getLoanById(loanId: string, userId: string): Promise<Loan> {
    const loan = await this.loanRepo.findById(loanId);
    if (!loan) {
      const err = new Error('Loan not found');
      (err as any).statusCode = 404;
      throw err;
    }
    if (loan.userId !== userId) {
      const err = new Error('Forbidden: Not your loan');
      (err as any).statusCode = 403;
      throw err;
    }
    return loan;
  }

  public async handleNeedDecision(
    loanId: string,
    userId: string,
    decision: NeedDecision,
  ): Promise<Loan> {
    const loan = await this.getLoanById(loanId, userId);
    const book = await this.bookRepo.findById(loan.bookId);
    const title = book ? book.title : 'Book';

    let updated: Loan;

    if (decision === 'STILL_NEED') {
      updated = await this.loanRepo.update(loanId, {
        needDecision: 'STILL_NEED',
        markedForReturn: false,
        followUpAt: null,
      });

      await this.notificationRepo.create({
        userId,
        title: 'Decision Recorded: Still Need Book',
        message: `You indicated you still need "${title}". Check renewal eligibility or explore alternative resources.`,
        kind: 'DECISION',
        read: false,
      });
    } else if (decision === 'DONE') {
      updated = await this.loanRepo.update(loanId, {
        needDecision: 'DONE',
        markedForReturn: true,
        followUpAt: null,
      });

      await this.notificationRepo.create({
        userId,
        title: 'Book Marked For Return',
        message: `"${title}" has been marked for return. Renewal reminders are suppressed.`,
        kind: 'DECISION',
        read: false,
      });
    } else {
      // NOT_SURE: Defer decision by 2 days, single reminder without repeated spam
      const followUpDate = addDays(new Date(), 2);
      updated = await this.loanRepo.update(loanId, {
        needDecision: 'NOT_SURE',
        markedForReturn: false,
        followUpAt: followUpDate,
      });

      await this.notificationRepo.create({
        userId,
        title: 'Decision Deferred',
        message: `A single follow-up reminder for "${title}" is scheduled for ${formatISO(followUpDate).slice(0, 10)}.`,
        kind: 'DECISION',
        read: false,
      });
    }

    return updated;
  }
}

