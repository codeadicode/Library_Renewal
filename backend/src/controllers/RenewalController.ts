import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { RenewalService } from '../services/RenewalService';

export class RenewalController {
  constructor(private renewalService: RenewalService) {}

  public checkEligibility = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const loanId = req.params.id;
      const result = await this.renewalService.evaluateEligibility(loanId, userId);
      res.status(200).json(result.eligibility);
    } catch (err) {
      next(err);
    }
  };

  public renewLoan = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const loanId = req.params.id;
      const result = await this.renewalService.processRenewal(loanId, userId);
      const statusCode = result.success ? 200 : 409;
      res.status(statusCode).json(result);
    } catch (err) {
      next(err);
    }
  };

  public getRenewalHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const loanId = req.params.id;
      const history = await this.renewalService.getRenewalHistory(loanId, userId);
      res.status(200).json(history);
    } catch (err) {
      next(err);
    }
  };
}

