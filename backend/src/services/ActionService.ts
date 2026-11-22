import { differenceInCalendarDays, formatISO } from 'date-fns';
import {
  IBookRepository,
  ILoanRepository,
  IPolicyRepository,
  IReservationRepository,
  IUserRepository,
} from '../repositories/interfaces';
import { Book, EligibilityResult, Loan } from '../types';
import { RenewalService } from './RenewalService';

export interface ActionItem {
  id: string;
  loanId: string;
  bookId: string;
  bookTitle: string;
  author: string;
  dueAt: string;
  daysRemaining: number;
  urgency: 'OVERDUE' | 'DUE_TODAY' | 'URGENT' | 'APPROACHING' | 'UPCOMING';
  eligibility: EligibilityResult;
  suggestedAction: string;
  actionLabel: string;
}

export class ActionService {
  constructor(
    private loanRepo: ILoanRepository,
    private bookRepo: IBookRepository,
    private renewalService: RenewalService,
    private policyRepo: IPolicyRepository,
    private userRepo: IUserRepository,
  ) {}

  public async getStudentActionCentre(userId: string): Promise<{
    stats: {
      borrowedCount: number;
      dueSoonCount: number;
      overdueCount: number;
      needsAttentionCount: number;
    };
    needsAttention: ActionItem[];
    loans: Array<{ loan: Loan; book: Book; daysRemaining: number }>;
  }> {
    const [loans, policy] = await Promise.all([
      this.loanRepo.findByUserId(userId),
      this.policyRepo.getDefaultPolicy(),
    ]);

    const activeLoans = loans.filter((l) => l.status === 'ACTIVE' || l.status === 'OVERDUE');
    const now = new Date();

    const enrichedLoans: Array<{ loan: Loan; book: Book; daysRemaining: number }> = [];
    const attentionItems: ActionItem[] = [];

    let overdueCount = 0;
    let dueSoonCount = 0;

    for (const loan of activeLoans) {
      const book = await this.bookRepo.findById(loan.bookId);
      if (!book) continue;

      const days = differenceInCalendarDays(new Date(loan.dueAt), now);
      enrichedLoans.push({ loan, book, daysRemaining: days });

      if (days < 0) overdueCount++;
      else if (days <= policy.approachingMaxDays) dueSoonCount++;

      // Check eligibility
      const { eligibility } = await this.renewalService.evaluateEligibility(loan.id, userId);

      let urgency: ActionItem['urgency'];
      if (days < 0) urgency = 'OVERDUE';
      else if (days === 0) urgency = 'DUE_TODAY';
      else if (days <= policy.urgentMaxDays) urgency = 'URGENT';
      else if (days <= policy.approachingMaxDays) urgency = 'APPROACHING';
      else urgency = 'UPCOMING';

      // Needs Attention filter:
      // Overdue, due within 7 days, or marked for return, or renewal blocked when due <= 3 days
      const requiresAttention =
        days <= policy.approachingMaxDays ||
        loan.markedForReturn ||
        (!eligibility.eligible && days <= policy.urgentMaxDays);

      if (requiresAttention) {
        let actionLabel = 'Check renewal';
        if (loan.markedForReturn) actionLabel = 'Prepare return';
        else if (!eligibility.eligible) {
          actionLabel =
            eligibility.suggested_action === 'FIND_ALTERNATIVE'
              ? 'Find alternatives'
              : 'Return book';
        }

        attentionItems.push({
          id: `action-${loan.id}`,
          loanId: loan.id,
          bookId: book.id,
          bookTitle: book.title,
          author: book.author,
          dueAt: formatISO(new Date(loan.dueAt)),
          daysRemaining: days,
          urgency,
          eligibility,
          suggestedAction: eligibility.suggested_action,
          actionLabel,
        });
      }
    }

    // Sort attention items by urgency (overdue and shortest days remaining first)
    attentionItems.sort((a, b) => a.daysRemaining - b.daysRemaining);

    return {
      stats: {
        borrowedCount: activeLoans.length,
        dueSoonCount,
        overdueCount,
        needsAttentionCount: attentionItems.length,
      },
      needsAttention: attentionItems,
      loans: enrichedLoans,
    };
  }
}

