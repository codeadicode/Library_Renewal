import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { LoanService } from '../services/LoanService';
import { decisionSchema } from '../validators';

export class LoanController {
  constructor(private loanService: LoanService) {}

  public getMyLoans = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const loans = await this.loanService.getUserLoans(userId);
      res.status(200).json(loans);
    } catch (err) {
      next(err);
    }
  };

  public getLoanById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const loanId = req.params.id;
      const loan = await this.loanService.getLoanById(loanId, userId);
      res.status(200).json(loan);
    } catch (err) {
      next(err);
    }
  };

  public submitNeedDecision = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const loanId = req.params.id;
      const { decision } = decisionSchema.parse(req.body);
      const updated = await this.loanService.handleNeedDecision(loanId, userId, decision);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  };
}

