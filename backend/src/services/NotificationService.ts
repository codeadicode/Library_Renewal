import { INotificationRepository } from '../repositories/interfaces';
import { Notification } from '../types';

export class NotificationService {
  constructor(private notifRepo: INotificationRepository) {}

  public async getUserNotifications(userId: string): Promise<Notification[]> {
    return this.notifRepo.findByUserId(userId);
  }

  public async markAsRead(id: string, userId: string): Promise<Notification> {
    const updated = await this.notifRepo.markRead(id, userId);
    if (!updated) {
      const err = new Error('Notification not found');
      (err as any).statusCode = 404;
      throw err;
    }
    return updated;
  }

  public async sendNotification(params: {
    userId: string;
    title: string;
    message: string;
    kind: string;
    suppressDuplicateWithinMinutes?: number;
  }): Promise<Notification | null> {
    const { userId, title, message, kind, suppressDuplicateWithinMinutes = 60 } = params;

    const isDuplicate = await this.notifRepo.findDuplicateRecent(
      userId,
      kind,
      title,
      suppressDuplicateWithinMinutes,
    );

    if (isDuplicate) {
      // Prevent duplicate notification spam
      return null;
    }

    return this.notifRepo.create({
      userId,
      title,
      message,
      kind,
      read: false,
    });
  }
}

