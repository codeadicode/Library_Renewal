import { addDays, differenceInCalendarDays, formatISO } from 'date-fns';
import { DataStore, Repositories } from '../repositories/interfaces';
import {
  AcademicContext,
  Book,
  EligibilityReasonCode,
  EligibilityResult,
  LibraryPolicy,
  Loan,
  RenewalAttempt,
  Reservation,
  User,
} from '../types';
import { now } from '../lib/clock';
import { forbidden, notFound } from '../lib/errors';
import { buildAcademicContext } from './academicPlanning';

/**
 * Pure renewal rules. Order matters: the first failing rule is reported.
 * Kept free of I/O so it is trivially unit-testable.
 */
export function evaluateRenewalRules(input: {
  loan: Loan;
  book: Book;
  user: User;
  policy: LibraryPolicy;
  reservations: Reservation[];
  at: Date;
}): {
  eligible: boolean;
  reasonCode: EligibilityReasonCode;
  reason: string;
  suggestedAction: EligibilityResult['suggested_action'];
  projectedDueAt?: Date;
} {
  const { loan, book, user, policy, reservations, at } = input;
  const daysRemaining = differenceInCalendarDays(new Date(loan.dueAt), at);
  const heldByOthers = reservations.filter((r) => r.status === 'ACTIVE' && r.userId !== user.id);

  if (loan.status === 'RETURNED' || loan.returnedAt) {
    return {
      eligible: false,
      reasonCode: 'LOAN_RETURNED',
      reason: 'This loan has already been returned, so it cannot be renewed.',
      suggestedAction: 'NONE',
    };
  }
  if (daysRemaining < 0) {
    return {
      eligible: false,
      reasonCode: 'LOAN_OVERDUE',
      reason: 'This loan is overdue. Overdue items must be returned before renewals are permitted.',
      suggestedAction: 'RETURN',
    };
  }
  if (user.restricted) {
    return {
      eligible: false,
      reasonCode: 'ACCOUNT_RESTRICTED',
      reason:
        'Your borrowing privileges have active restrictions. Contact the helpdesk or find alternative learning resources.',
      suggestedAction: 'FIND_ALTERNATIVE',
    };
  }
  if (!book.renewable) {
    return {
      eligible: false,
      reasonCode: 'ITEM_NOT_RENEWABLE',
      reason: 'This title is designated as reference or non-renewable in the library policy.',
      suggestedAction: 'FIND_ALTERNATIVE',
    };
  }
  if (heldByOthers.length > 0) {
    return {
      eligible: false,
      reasonCode: 'ACTIVE_RESERVATION',
      reason:
        'Another student has reserved this book. To keep resources moving, look at alternatives covering the same topics.',
      suggestedAction: 'FIND_ALTERNATIVE',
    };
  }
  if (loan.renewalCount >= policy.maxRenewals) {
    return {
      eligible: false,
      reasonCode: 'MAX_RENEWALS_REACHED',
      reason: `Maximum renewal limit (${policy.maxRenewals}) reached for this loan item.`,
      suggestedAction: 'FIND_ALTERNATIVE',
    };
  }
  return {
    eligible: true,
    reasonCode: 'ELIGIBLE',
    reason: `Eligible for a ${policy.renewalPeriodDays}-day renewal under ${policy.name}.`,
    suggestedAction: 'RENEW',
    projectedDueAt: addDays(new Date(loan.dueAt), policy.renewalPeriodDays),
  };
}

export class RenewalService {
  constructor(private store: DataStore) {}

  public async evaluateEligibility(
    loanId: string,
    authenticatedUserId: string,
    repos: Repositories = this.store.repos,
  ): Promise<{ eligibility: EligibilityResult; loan: Loan; academicContext: AcademicContext | null }> {
    const loan = await repos.loans.findById(loanId);
    if (!loan) throw notFound('Loan not found');
    if (loan.userId !== authenticatedUserId) throw forbidden('Forbidden: You do not own this loan');

    const [book, user, policy, reservations, needs, topics, courses] = await Promise.all([
      repos.books.findById(loan.bookId),
      repos.users.findById(authenticatedUserId),
      repos.policy.getDefaultPolicy(),
      repos.reservations.findActiveByBookId(loan.bookId),
      repos.academicNeeds.findByUserId(authenticatedUserId),
      repos.books.findTopics(),
      repos.books.findCourses(),
    ]);
    if (!user) throw notFound('User not found');
    if (!book) throw notFound('Book record not found');

    const at = now();
    const rules = evaluateRenewalRules({ loan, book, user, policy, reservations, at });

    const academicContext =
      loan.status === 'RETURNED'
        ? null
        : buildAcademicContext({
            book,
            needs,
            topicLookup: new Map(topics.map((t) => [t.id, t])),
            courseLookup: new Map(courses.map((c) => [c.id, c])),
            dueAt: new Date(loan.dueAt),
            projectedDueAt: rules.projectedDueAt,
            at,
          });

    const eligibility: EligibilityResult = {
      eligible: rules.eligible,
      reason_code: rules.reasonCode,
      reason: rules.reason,
      suggested_action: rules.suggestedAction,
      policy_name: policy.name,
      max_renewals: policy.maxRenewals,
      renewals_used: loan.renewalCount,
      current_due_at: formatISO(new Date(loan.dueAt)),
      ...(rules.projectedDueAt ? { projected_due_at: formatISO(rules.projectedDueAt) } : {}),
      academic_context: academicContext,
    };

    return { eligibility, loan, academicContext };
  }

  /**
   * Renews a loan. The row lock, the eligibility re-check, the loan update and
   * the audit row all happen in one transaction, so:
   *  - two concurrent requests cannot both renew (the second waits for the
   *    lock, then sees the incremented renewal count / new due date);
   *  - a renewal is never recorded without its audit row, or vice versa.
   */
  public async processRenewal(
    loanId: string,
    authenticatedUserId: string,
  ): Promise<{
    success: boolean;
    eligibility: EligibilityResult;
    loan: Loan;
    attempt: RenewalAttempt;
  }> {
    return this.store.transaction(async (tx) => {
      await tx.loans.lockForUpdate(loanId);
      const { eligibility, loan } = await this.evaluateEligibility(loanId, authenticatedUserId, tx);

      if (!eligibility.eligible) {
        const attempt = await tx.renewalAttempts.create({
          loanId,
          eligible: false,
          reasonCode: eligibility.reason_code,
          reason: eligibility.reason,
          newDueAt: null,
        });
        return { success: false, eligibility, loan, attempt };
      }

      const policy = await tx.policy.getDefaultPolicy();
      const newDueDate = addDays(new Date(loan.dueAt), policy.renewalPeriodDays);
      const updatedLoan = await tx.loans.update(loanId, {
        dueAt: newDueDate,
        renewalCount: loan.renewalCount + 1,
      });

      const attempt = await tx.renewalAttempts.create({
        loanId,
        eligible: true,
        reasonCode: 'RENEWAL_SUCCESS',
        reason: `Successfully renewed for ${policy.renewalPeriodDays} days. New due date: ${formatISO(newDueDate, {
          representation: 'date',
        })}.`,
        newDueAt: newDueDate,
      });

      return { success: true, eligibility, loan: updatedLoan, attempt };
    });
  }

  public async getRenewalHistory(loanId: string, authenticatedUserId: string): Promise<RenewalAttempt[]> {
    const loan = await this.store.repos.loans.findById(loanId);
    if (!loan) throw notFound('Loan not found');
    if (loan.userId !== authenticatedUserId) throw forbidden('Forbidden');
    return this.store.repos.renewalAttempts.findByLoanId(loanId);
  }
}
