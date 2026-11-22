import { differenceInCalendarDays } from 'date-fns';
import {
  IFineRepository,
  ILoanRepository,
  IPolicyRepository,
} from '../repositories/interfaces';
import { FineLedger, Loan } from '../types';

export class FineService {
  constructor(
    private fineRepo: IFineRepository,
    private loanRepo: ILoanRepository,
    private policyRepo: IPolicyRepository,
  ) {}

  public async getUserFines(userId: string): Promise<{
    currentBalance: number;
    dailyRate: number;
    fineHistory: FineLedger[];
    activeOverdueFines: Array<{
      loanId: string;
      daysOverdue: number;
      estimatedFine: number;
    }>;
  }> {
    const [fines, loans, policy] = await Promise.all([
      this.fineRepo.findByUserId(userId),
      this.loanRepo.findByUserId(userId),
      this.policyRepo.getDefaultPolicy(),
    ]);

    const currentBalance = fines.reduce((sum, f) => sum + f.amount, 0);
    const now = new Date();

    const activeOverdueFines: Array<{
      loanId: string;
      daysOverdue: number;
      estimatedFine: number;
    }> = [];

    for (const loan of loans) {
      if (loan.status === 'OVERDUE' || loan.status === 'ACTIVE') {
        const days = differenceInCalendarDays(new Date(loan.dueAt), now);
        if (days < 0) {
          const daysOverdue = Math.abs(days);
          activeOverdueFines.push({
            loanId: loan.id,
            daysOverdue,
            estimatedFine: daysOverdue * policy.finePerDay,
          });
        }
      }
    }

    return {
      currentBalance,
      dailyRate: policy.finePerDay,
      fineHistory: fines,
      activeOverdueFines,
    };
  }

  public async estimateLateFine(loanId: string, returnDate?: Date): Promise<{
    daysLate: number;
    estimatedAmount: number;
    dailyRate: number;
    calculation: string;
  }> {
    const loan = await this.loanRepo.findById(loanId);
    if (!loan) throw new Error('Loan not found');
    const policy = await this.policyRepo.getDefaultPolicy();

    const compareDate = returnDate || new Date();
    const daysDiff = differenceInCalendarDays(compareDate, new Date(loan.dueAt));
    const daysLate = Math.max(0, daysDiff);
    const estimatedAmount = daysLate * policy.finePerDay;

    return {
      daysLate,
      estimatedAmount,
      dailyRate: policy.finePerDay,
      calculation: `${daysLate} overdue days × ₹${policy.finePerDay}/day = ₹${estimatedAmount}`,
    };
  }
}

