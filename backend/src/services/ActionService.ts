import { differenceInCalendarDays, format, formatISO } from 'date-fns';
import { DataStore } from '../repositories/interfaces';
import { AcademicContext, Book, EligibilityResult, Loan } from '../types';
import { now } from '../lib/clock';
import { RenewalService } from './RenewalService';

export type Urgency = 'OVERDUE' | 'DUE_TODAY' | 'URGENT' | 'APPROACHING' | 'UPCOMING';

export interface ActionItem {
  id: string;
  loanId: string;
  bookId: string;
  bookTitle: string;
  author: string;
  dueAt: string;
  daysRemaining: number;
  urgency: Urgency;
  eligibility: EligibilityResult;
  academicContext: AcademicContext | null;
  suggestedAction: string;
  actionLabel: string;
  /** Short human explanation of why this loan needs attention. */
  why: string;
}

export interface ActionCentreLoan {
  loan: Loan;
  book: Book;
  daysRemaining: number;
  urgency: Urgency;
  eligibility: EligibilityResult;
  academicContext: AcademicContext | null;
}

const shortDate = (iso: string) => format(new Date(iso), 'd MMM');

export class ActionService {
  constructor(
    private store: DataStore,
    private renewalService: RenewalService,
  ) {}

  public async getStudentActionCentre(userId: string): Promise<{
    stats: { borrowedCount: number; dueSoonCount: number; overdueCount: number; needsAttentionCount: number };
    needsAttention: ActionItem[];
    loans: ActionCentreLoan[];
  }> {
    const { repos } = this.store;
    const [loans, policy] = await Promise.all([repos.loans.findByUserId(userId), repos.policy.getDefaultPolicy()]);
    const openLoans = loans.filter((l) => l.status !== 'RETURNED');
    const at = now();

    const enriched: ActionCentreLoan[] = [];
    const attention: ActionItem[] = [];
    let overdueCount = 0;
    let dueSoonCount = 0;

    for (const loan of openLoans) {
      const book = await repos.books.findById(loan.bookId);
      if (!book) continue;

      const days = differenceInCalendarDays(new Date(loan.dueAt), at);
      const { eligibility, academicContext } = await this.renewalService.evaluateEligibility(loan.id, userId);

      let urgency: Urgency;
      if (days < 0) urgency = 'OVERDUE';
      else if (days === 0) urgency = 'DUE_TODAY';
      else if (days <= policy.urgentMaxDays) urgency = 'URGENT';
      else if (days <= policy.approachingMaxDays) urgency = 'APPROACHING';
      else urgency = 'UPCOMING';

      if (days < 0) overdueCount++;
      else if (days <= policy.approachingMaxDays) dueSoonCount++;

      enriched.push({ loan, book, daysRemaining: days, urgency, eligibility, academicContext });

      // An upcoming assessment that needs this book past its due date is a reason to
      // act now, even when the due date itself is still outside the usual window.
      const assessmentPressure =
        !!academicContext?.needed_beyond_due &&
        academicContext.days_until_assessment <= policy.approachingMaxDays * 2;

      const requiresAttention =
        days <= policy.approachingMaxDays ||
        loan.markedForReturn ||
        assessmentPressure ||
        (!eligibility.eligible && days <= policy.urgentMaxDays);
      if (!requiresAttention) continue;

      const { actionLabel, why } = this.describe(loan, days, eligibility, academicContext);
      attention.push({
        id: `action-${loan.id}`,
        loanId: loan.id,
        bookId: book.id,
        bookTitle: book.title,
        author: book.author,
        dueAt: formatISO(new Date(loan.dueAt)),
        daysRemaining: days,
        urgency,
        eligibility,
        academicContext,
        suggestedAction: eligibility.suggested_action,
        actionLabel,
        why,
      });
    }

    // Most urgent first; on a tie, loans still needed for an assessment come first.
    attention.sort((a, b) => {
      if (a.daysRemaining !== b.daysRemaining) return a.daysRemaining - b.daysRemaining;
      return Number(!!b.academicContext?.needed_beyond_due) - Number(!!a.academicContext?.needed_beyond_due);
    });

    return {
      stats: {
        borrowedCount: openLoans.length,
        dueSoonCount,
        overdueCount,
        needsAttentionCount: attention.length,
      },
      needsAttention: attention,
      loans: enriched,
    };
  }

  private describe(
    loan: Loan,
    days: number,
    eligibility: EligibilityResult,
    ctx: AcademicContext | null,
  ): { actionLabel: string; why: string } {
    if (loan.markedForReturn) {
      return { actionLabel: 'Prepare return', why: 'You marked this book as done.' };
    }
    if (days < 0) {
      return { actionLabel: 'Return book', why: `Overdue by ${Math.abs(days)} day(s); a fine is accruing.` };
    }

    if (ctx) {
      const need = `${ctx.topic} ${ctx.assessment_type.toLowerCase()} on ${shortDate(ctx.assessment_date)}`;
      if (!ctx.needed_beyond_due) {
        return {
          actionLabel: eligibility.eligible ? 'Check renewal' : 'Plan return',
          why: `Covers your ${need}; the current due date already lasts until you need it.`,
        };
      }
      if (eligibility.eligible) {
        return ctx.renewal_covers_need
          ? { actionLabel: 'Renew now', why: `Needed until ${shortDate(ctx.needed_until)} for your ${need}. One renewal covers it.` }
          : {
              actionLabel: 'Renew + find backup',
              why: `Needed until ${shortDate(ctx.needed_until)} for your ${need}; even a renewal ends earlier.`,
            };
      }
      return {
        actionLabel: 'Find alternatives',
        why: `Needed until ${shortDate(ctx.needed_until)} for your ${need}, but it cannot be renewed: ${eligibility.reason}`,
      };
    }

    if (!eligibility.eligible) {
      return {
        actionLabel: eligibility.suggested_action === 'FIND_ALTERNATIVE' ? 'Find alternatives' : 'Return book',
        why: eligibility.reason,
      };
    }
    return loan.needDecision
      ? { actionLabel: 'Check renewal', why: `Due in ${days} day(s).` }
      : { actionLabel: 'Still need it?', why: `Due in ${days} day(s) and not linked to any upcoming assessment.` };
  }
}
