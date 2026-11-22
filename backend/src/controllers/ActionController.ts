import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { ActionService } from '../services/ActionService';

export class ActionController {
  constructor(private actionService: ActionService) {}

  public getActions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const feed = await this.actionService.getStudentActionCentre(userId);
      res.status(200).json(feed);
    } catch (err) {
      next(err);
    }
  };
}

