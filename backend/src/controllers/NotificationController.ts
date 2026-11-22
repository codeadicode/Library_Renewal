import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { NotificationService } from '../services/NotificationService';

export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  public getNotifications = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.user!.id;
      const notifs = await this.notificationService.getUserNotifications(userId);
      res.status(200).json(notifs);
    } catch (err) {
      next(err);
    }
  };

  public markAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const id = req.params.id;
      const updated = await this.notificationService.markAsRead(id, userId);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  };

  public getScheduled = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rows = await this.notificationService.getPendingScheduled(req.user!.id);
      res.status(200).json(rows);
    } catch (err) {
      next(err);
    }
  };
}
