import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AlternativeResourceService } from '../services/AlternativeResourceService';

export class AlternativeController {
  constructor(private alternativeService: AlternativeResourceService) {}

  public getAlternativesForBook = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const bookId = req.params.id;
      const userId = req.user!.id;
      const result = await this.alternativeService.findAlternativesForBook(bookId, userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

