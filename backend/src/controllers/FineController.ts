import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { FineService } from '../services/FineService';

export class FineController {
  constructor(private fineService: FineService) {}

  public getFines = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const fines = await this.fineService.getUserFines(userId);
      res.status(200).json(fines);
    } catch (err) {
      next(err);
    }
  };

  public estimateFine = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const loanId = req.params.loanId;
      const estimate = await this.fineService.estimateLateFine(loanId);
      res.status(200).json(estimate);
    } catch (err) {
      next(err);
    }
  };
}

