import { addDays, differenceInCalendarDays, formatISO } from 'date-fns';
import { DataStore } from '../repositories/interfaces';
import { FineLedger, Loan, NeedDecision } from '../types';
import { now } from '../lib/clock';
import { conflict, forbidden, notFound } from '../lib/errors';
import { formatRupees, multiplyMoney } from '../lib/money';
import { NotificationService } from './NotificationService';

export const FOLLOW_UP_DELAY_DAYS = 2;

export class LoanService {
  constructor(
    private store: DataStore,
    private notifications: NotificationService,
  ) {}

  public getUserLoans(userId: string): Promise<Loan[]> {
    return this.store.repos.loans.findByUserId(userId);
  }

  public async getLoanById(loanId: string, userId: string): Promise<Loan> {
    const loan = await this.store.repos.loans.findById(loanId);
    if (!loan) throw notFound('Loan not found');
    if (loan.userId !== userId) throw forbidden('Forbidden: Not your loan');
    return loan;
  }

  /**
   * Records "do you still need this book?". All writes (loan, cancelled or new
   * follow-up, confirmation) commit together.
   */
  public async handleNeedDecision(loanId: string, userId: string, decision: NeedDecision): Promise<Loan> {
    return this.store.transaction(async (tx) => {
      await tx.loans.lockForUpdate(loanId);
      const loan = await tx.loans.findById(loanId);
      if (!loan) throw notFound('Loan not found');
      if (loan.userId !== userId) throw forbidden('Forbidden: Not your loan');
      if (loan.status === 'RETURNED') throw conflict('This loan has already been returned.', 'LOAN_RETURNED');

      const book = await tx.books.findById(loan.bookId);
      const title = book ? book.title : 'Book';

      // Any decision replaces an earlier "not sure" follow-up.
      await this.notifications.cancelForLoan(loanId, 'FOLLOW_UP', tx);

      if (decision === 'STILL_NEED') {
        const updated = await tx.loans.update(loanId, { needDecision: 'STILL_NEED', markedForReturn: false, followUpAt: null });
        await this.notifications.notify(
          {
            userId,
            loanId,
            kind: 'DECISION',
            title: 'Decision recorded: still need book',
            message: `You still need "${title}". Check renewal eligibility or explore alternative resources.`,
            dedupeWithinMinutes: 0,
          },
          tx,
        );
        return updated;
      }

      if (decision === 'DONE') {
        const updated = await tx.loans.update(loanId, { needDecision: 'DONE', markedForReturn: true, followUpAt: null });
        await this.notifications.notify(
          {
            userId,
            loanId,
            kind: 'DECISION',
            title: 'Book marked for return',
            message: `"${title}" has been marked for return. Due-soon reminders for it are switched off.`,
            dedupeWithinMinutes: 0,
          },
          tx,
        );
        return updated;
      }

      // NOT_SURE: exactly one persisted follow-up, never earlier than now and never after the due date.
      const at = now();
      const dueAt = new Date(loan.dueAt);
      let followUpAt = addDays(at, FOLLOW_UP_DELAY_DAYS);
      if (followUpAt > dueAt) followUpAt = dueAt > at ? dueAt : at;

      const updated = await tx.loans.update(loanId, { needDecision: 'NOT_SURE', markedForReturn: false, followUpAt });
      await this.notifications.schedule(
        {
          userId,
          loanId,
          kind: 'FOLLOW_UP',
          title: `Still need "${title}"?`,
          message: `You weren't sure if you still need "${title}". It is due ${formatISO(dueAt, { representation: 'date' })} — decide whether to renew or return it.`,
          sendAt: followUpAt,
        },
        tx,
      );
      await this.notifications.notify(
        {
          userId,
          loanId,
          kind: 'DECISION',
          title: 'Decision deferred',
          message: `One follow-up reminder for "${title}" is scheduled for ${formatISO(followUpAt, { representation: 'date' })}.`,
          dedupeWithinMinutes: 0,
        },
        tx,
      );
      return updated;
    });
  }

  /**
   * Simulated return desk. Closes the loan, frees (or holds) the copy and, if
   * the book is late, writes the fine to the ledger — all in one transaction.
   */
  public async returnLoan(loanId: string, userId: string): Promise<{ loan: Loan; fine: FineLedger | null }> {
    return this.store.transaction(async (tx) => {
      await tx.loans.lockForUpdate(loanId);
      const loan = await tx.loans.findById(loanId);
      if (!loan) throw notFound('Loan not found');
      if (loan.userId !== userId) throw forbidden('Forbidden: Not your loan');
      if (loan.status === 'RETURNED') throw conflict('This loan has already been returned.', 'LOAN_RETURNED');

      const at = now();
      const [policy, book, holds] = await Promise.all([
        tx.policy.getDefaultPolicy(),
        tx.books.findById(loan.bookId),
        tx.reservations.findActiveByBookId(loan.bookId),
      ]);

      const updated = await tx.loans.update(loanId, {
        status: 'RETURNED',
        returnedAt: at,
        markedForReturn: false,
        followUpAt: null,
      });
      await tx.books.updateCopyStatus(loan.copyId, holds.some((h) => h.userId !== userId) ? 'RESERVED' : 'AVAILABLE');
      await this.notifications.cancelForLoan(loanId, undefined, tx);

      let fine: FineLedger | null = null;
      const daysLate = Math.max(0, differenceInCalendarDays(at, new Date(loan.dueAt)));
      const alreadyCharged = (await tx.fines.findByLoanId(loanId)).length > 0;
      if (daysLate > 0 && !alreadyCharged) {
        const amount = multiplyMoney(policy.finePerDay, daysLate);
        fine = await tx.fines.create({
          userId,
          loanId,
          amount,
          reason: `Returned late: ${book?.title ?? 'book'} (${daysLate} day${daysLate === 1 ? '' : 's'} × ${formatRupees(policy.finePerDay)}/day)`,
        });
      }

      await this.notifications.notify(
        {
          userId,
          loanId,
          kind: 'RETURNED',
          title: 'Book returned',
          message: fine
            ? `"${book?.title ?? 'Book'}" was returned ${daysLate} day(s) late. ${formatRupees(fine.amount)} was added to your fine ledger.`
            : `"${book?.title ?? 'Book'}" was returned on time.`,
          dedupeWithinMinutes: 0,
        },
        tx,
      );

      return { loan: updated, fine };
    });
  }

  /** Simulated issue desk: claims a free physical copy and opens a standard-length loan. */
  public async borrowBook(bookId: string, userId: string): Promise<Loan> {
    return this.store.transaction(async (tx) => {
      const [user, book, policy, existing] = await Promise.all([
        tx.users.findById(userId),
        tx.books.findById(bookId),
        tx.policy.getDefaultPolicy(),
        tx.loans.findByUserId(userId),
      ]);
      if (!user) throw notFound('User not found');
      if (!book) throw notFound('Book not found');
      if (user.restricted) throw forbidden('This account is restricted and cannot borrow books.');
      if (book.resourceType === 'DIGITAL') throw conflict('This title is digital-only; open it from the catalogue instead.', 'DIGITAL_ONLY');
      if (existing.some((l) => l.bookId === bookId && l.status !== 'RETURNED')) {
        throw conflict('You already have this book issued.', 'ALREADY_BORROWED');
      }

      const copy = await tx.books.claimAvailableCopy(bookId, 'ON_LOAN');
      if (!copy) throw conflict('No physical copy is free right now. Try reserving it.', 'NO_COPY_AVAILABLE');

      const at = now();
      const loan = await tx.loans.create({
        copyId: copy.id,
        userId,
        bookId,
        issuedAt: at,
        dueAt: addDays(at, policy.loanPeriodDays),
        returnedAt: null,
        status: 'ACTIVE',
        renewalCount: 0,
        markedForReturn: false,
        needDecision: null,
        followUpAt: null,
      });

      await this.notifications.notify(
        {
          userId,
          loanId: loan.id,
          kind: 'ISSUED',
          title: 'Book issued',
          message: `"${book.title}" is issued until ${formatISO(new Date(loan.dueAt), { representation: 'date' })}.`,
          dedupeWithinMinutes: 0,
        },
        tx,
      );
      return loan;
    });
  }
}
