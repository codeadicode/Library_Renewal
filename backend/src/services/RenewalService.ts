import { addDays, differenceInCalendarDays, formatISO } from 'date-fns';
import {
  IBookRepository,
  ILoanRepository,
  IPolicyRepository,
  IRenewalAttemptRepository,
  IReservationRepository,
  IUserRepository,
} from '../repositories/interfaces';
import { EligibilityResult, Loan, RenewalAttempt, User } from '../types';

export class RenewalService {
  constructor(
    private loanRepo: ILoanRepository,
    private bookRepo: IBookRepository,
    private reservationRepo: IReservationRepository,
    private userRepo: IUserRepository,
    private policyRepo: IPolicyRepository,
    private renewalAttemptRepo: IRenewalAttemptRepository,
  ) {}

  public async evaluateEligibility(
    loanId: string,
    authenticatedUserId: string,
  ): Promise<{ eligibility: EligibilityResult; loan: Loan }> {
    const loan = await this.loanRepo.findById(loanId);
    if (!loan) {
      const err = new Error('Loan not found');
      (err as any).statusCode = 404;
      throw err;
    }

    // Enforce ownership check
    if (loan.userId !== authenticatedUserId) {
      const err = new Error('Forbidden: You do not own this loan');
      (err as any).statusCode = 403;
      throw err;
    }

    const [book, user, policy, reservations] = await Promise.all([
      this.bookRepo.findById(loan.bookId),
      this.userRepo.findById(authenticatedUserId),
      this.policyRepo.getDefaultPolicy(),
      this.reservationRepo.findActiveByBookId(loan.bookId),
    ]);

    if (!user) throw new Error('User not found');
    if (!book) throw new Error('Book record not found');

    const now = new Date();
    const daysRemaining = differenceInCalendarDays(new Date(loan.dueAt), now);
    const activeReservationsByOthers = reservations.filter((r) => r.userId !== authenticatedUserId);

    let result: EligibilityResult;

    // RULE 1: Overdue loans cannot be renewed
    if (daysRemaining < 0 || loan.status === 'OVERDUE') {
      result = {
        eligible: false,
        reason_code: 'LOAN_OVERDUE',
        reason: 'This loan is overdue. Overdue items must be returned before renewals are permitted.',
        suggested_action: 'RETURN',
        policy_name: policy.name,
        max_renewals: policy.maxRenewals,
        renewals_used: loan.renewalCount,
        current_due_at: formatISO(new Date(loan.dueAt)),
      };
    }
    // RULE 2: Restricted student accounts
    else if (user.restricted) {
      result = {
        eligible: false,
        reason_code: 'ACCOUNT_RESTRICTED',
        reason: 'Your borrowing privileges have active restrictions. Contact the helpdesk or find alternative learning resources.',
        suggested_action: 'FIND_ALTERNATIVE',
        policy_name: policy.name,
        max_renewals: policy.maxRenewals,
        renewals_used: loan.renewalCount,
        current_due_at: formatISO(new Date(loan.dueAt)),
      };
    }
    // RULE 3: Item marked not renewable in policy / catalogue
    else if (!book.renewable) {
      result = {
        eligible: false,
        reason_code: 'ITEM_NOT_RENEWABLE',
        reason: 'This title is designated as reference or non-renewable in the library policy.',
        suggested_action: 'FIND_ALTERNATIVE',
        policy_name: policy.name,
        max_renewals: policy.maxRenewals,
        renewals_used: loan.renewalCount,
        current_due_at: formatISO(new Date(loan.dueAt)),
      };
    }
    // RULE 4: Another student has placed an active hold/reservation
    else if (activeReservationsByOthers.length > 0) {
      result = {
        eligible: false,
        reason_code: 'ACTIVE_RESERVATION',
        reason: 'Another student has reserved this book. To maintain student resource continuity, discover alternative resources covering these topics.',
        suggested_action: 'FIND_ALTERNATIVE',
        policy_name: policy.name,
        max_renewals: policy.maxRenewals,
        renewals_used: loan.renewalCount,
        current_due_at: formatISO(new Date(loan.dueAt)),
      };
    }
    // RULE 5: Maximum renewal count reached
    else if (loan.renewalCount >= policy.maxRenewals) {
      result = {
        eligible: false,
        reason_code: 'MAX_RENEWALS_REACHED',
        reason: `Maximum renewal limit (${policy.maxRenewals}) reached for this loan item.`,
        suggested_action: 'FIND_ALTERNATIVE',
        policy_name: policy.name,
        max_renewals: policy.maxRenewals,
        renewals_used: loan.renewalCount,
        current_due_at: formatISO(new Date(loan.dueAt)),
      };
    }
    // SUCCESS: Eligible for renewal
    else {
      const projectedDueDate = addDays(new Date(loan.dueAt), policy.renewalPeriodDays);
      result = {
        eligible: true,
        reason_code: 'RENEWAL_SUCCESS',
        reason: `Eligible for a ${policy.renewalPeriodDays}-day renewal under ${policy.name}.`,
        suggested_action: 'RENEW',
        policy_name: policy.name,
        max_renewals: policy.maxRenewals,
        renewals_used: loan.renewalCount,
        current_due_at: formatISO(new Date(loan.dueAt)),
        projected_due_at: formatISO(projectedDueDate),
      };
    }

    return { eligibility: result, loan };
  }

  public async processRenewal(
    loanId: string,
    authenticatedUserId: string,
  ): Promise<{
    success: boolean;
    eligibility: EligibilityResult;
    loan: Loan;
    attempt: RenewalAttempt;
  }> {
    const { eligibility, loan } = await this.evaluateEligibility(loanId, authenticatedUserId);
    const policy = await this.policyRepo.getDefaultPolicy();

    if (!eligibility.eligible) {
      // Record failed attempt for transparency & history
      const attempt = await this.renewalAttemptRepo.create({
        loanId,
        eligible: false,
        reasonCode: eligibility.reason_code,
        reason: eligibility.reason,
        newDueAt: null,
      });

      return {
        success: false,
        eligibility,
        loan,
        attempt,
      };
    }

    // Successful Renewal Transaction
    const newDueDate = addDays(new Date(loan.dueAt), policy.renewalPeriodDays);
    const updatedLoan = await this.loanRepo.update(loanId, {
      dueAt: newDueDate,
      renewalCount: loan.renewalCount + 1,
      status: 'ACTIVE',
    });

    const attempt = await this.renewalAttemptRepo.create({
      loanId,
      eligible: true,
      reasonCode: 'RENEWAL_SUCCESS',
      reason: `Successfully renewed for ${policy.renewalPeriodDays} days. New due date: ${formatISO(newDueDate).slice(0, 10)}.`,
      newDueAt: newDueDate,
    });

    return {
      success: true,
      eligibility,
      loan: updatedLoan,
      attempt,
    };
  }

  public async getRenewalHistory(
    loanId: string,
    authenticatedUserId: string,
  ): Promise<RenewalAttempt[]> {
    const loan = await this.loanRepo.findById(loanId);
    if (!loan) {
      const err = new Error('Loan not found');
      (err as any).statusCode = 404;
      throw err;
    }
    if (loan.userId !== authenticatedUserId) {
      const err = new Error('Forbidden');
      (err as any).statusCode = 403;
      throw err;
    }

    return this.renewalAttemptRepo.findByLoanId(loanId);
  }
}

