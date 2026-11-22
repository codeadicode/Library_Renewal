import { addDays, differenceInCalendarDays, setHours, startOfHour } from 'date-fns';
import { config } from '../config';
import { DataStore, Repositories } from '../repositories/interfaces';
import {
  Notification,
  NotificationPreference,
  NotificationPriority,
  ScheduledNotification,
} from '../types';
import { now } from '../lib/clock';
import { notFound } from '../lib/errors';

/** Kinds of notification the system emits, and how important each one is. */
export const NOTIFICATION_PRIORITY: Record<string, NotificationPriority> = {
  OVERDUE: 'HIGH',
  DUE_TODAY: 'HIGH',
  RENEWAL_BLOCKED: 'HIGH',
  FOLLOW_UP: 'HIGH', // the student explicitly asked to be reminded
  DUE_SOON: 'NORMAL',
  RENEWAL_OPPORTUNITY: 'NORMAL',
  RESERVATION: 'NORMAL',
  DECISION: 'LOW',
  RENEWAL_SUCCESS: 'LOW',
  RETURNED: 'LOW',
  ISSUED: 'LOW',
};

export const priorityOf = (kind: string): NotificationPriority => NOTIFICATION_PRIORITY[kind] ?? 'NORMAL';

export type DeliveryRoute = 'DELIVER' | 'DIGEST' | 'SUPPRESS';

/**
 * Preference routing table.
 *  NORMAL    – everything, immediately.
 *  IMPORTANT – HIGH priority only; the rest is dropped.
 *  DIGEST    – HIGH immediately; NORMAL and LOW are batched into one daily digest.
 *  QUIET     – only OVERDUE (fines are accruing); everything else is dropped.
 */
export function routeFor(preference: NotificationPreference, kind: string): DeliveryRoute {
  const priority = priorityOf(kind);
  switch (preference) {
    case 'NORMAL':
      return 'DELIVER';
    case 'IMPORTANT':
      return priority === 'HIGH' ? 'DELIVER' : 'SUPPRESS';
    case 'DIGEST':
      return priority === 'HIGH' ? 'DELIVER' : 'DIGEST';
    case 'QUIET':
      return kind === 'OVERDUE' ? 'DELIVER' : 'SUPPRESS';
    default:
      return 'DELIVER';
  }
}

const DIGEST_PREFIX = 'DIGEST:';

/** Next digest delivery time (DIGEST_HOUR o'clock, today if still ahead, else tomorrow). */
export function nextDigestTime(at: Date, hour = config.digestHour): Date {
  const today = startOfHour(setHours(at, hour));
  return today > at ? today : addDays(today, 1);
}

export interface NotifyInput {
  userId: string;
  loanId?: string | null;
  kind: string;
  title: string;
  message: string;
  /** Skip if an identical (user, kind, title) notification was created within this window. */
  dedupeWithinMinutes?: number;
}

export interface NotifyResult {
  route: DeliveryRoute | 'DUPLICATE';
  notification?: Notification;
  scheduled?: ScheduledNotification;
}

export class NotificationService {
  constructor(private store: DataStore) {}

  public getUserNotifications(userId: string): Promise<Notification[]> {
    return this.store.repos.notifications.findByUserId(userId);
  }

  public getPendingScheduled(userId: string): Promise<ScheduledNotification[]> {
    return this.store.repos.scheduledNotifications.findPendingByUserId(userId);
  }

  public async markAsRead(id: string, userId: string): Promise<Notification> {
    const updated = await this.store.repos.notifications.markRead(id, userId);
    if (!updated) throw notFound('Notification not found');
    return updated;
  }

  /** Sends (or digests, or drops) a notification according to the user's preference. */
  public async notify(input: NotifyInput, repos: Repositories = this.store.repos): Promise<NotifyResult> {
    const user = await repos.users.findById(input.userId);
    if (!user) throw notFound('User not found');
    const at = now();
    const route = routeFor(user.notificationPreference, input.kind);

    if (route === 'SUPPRESS') return { route };

    const window = input.dedupeWithinMinutes ?? 60;
    if (window > 0) {
      const since = new Date(at.getTime() - window * 60_000);
      if (await repos.notifications.findDuplicateRecent(input.userId, input.kind, input.title, since)) {
        return { route: 'DUPLICATE' };
      }
    }

    if (route === 'DIGEST') {
      const scheduled = await repos.scheduledNotifications.create({
        userId: input.userId,
        loanId: input.loanId ?? null,
        kind: `${DIGEST_PREFIX}${input.kind}`,
        title: input.title,
        message: input.message,
        sendAt: nextDigestTime(at),
      });
      return { route, scheduled };
    }

    const notification = await repos.notifications.create({
      userId: input.userId,
      loanId: input.loanId ?? null,
      kind: input.kind,
      title: input.title,
      message: input.message,
      read: false,
    });
    return { route, notification };
  }

  /** Persists a notification for later delivery. Survives restarts. */
  public schedule(
    input: Omit<NotifyInput, 'dedupeWithinMinutes'> & { sendAt: Date },
    repos: Repositories = this.store.repos,
  ): Promise<ScheduledNotification> {
    return repos.scheduledNotifications.create({
      userId: input.userId,
      loanId: input.loanId ?? null,
      kind: input.kind,
      title: input.title,
      message: input.message,
      sendAt: input.sendAt,
    });
  }

  public cancelForLoan(loanId: string, kind?: string, repos: Repositories = this.store.repos): Promise<number> {
    return repos.scheduledNotifications.cancelPendingForLoan(loanId, kind);
  }

  /**
   * Delivers every scheduled notification whose time has come.
   *  - Follow-ups are re-checked at delivery time: if the loan was returned or
   *    the student has since decided, they are cancelled; the user's *current*
   *    preference is applied.
   *  - DIGEST items are combined into one notification per user.
   */
  public async dispatchDue(at: Date = now(), batchSize = 200): Promise<{ delivered: number; skipped: number }> {
    const repos = this.store.repos;
    const due = await repos.scheduledNotifications.findDue(at, batchSize);
    let delivered = 0;
    let skipped = 0;

    const digestByUser = new Map<string, ScheduledNotification[]>();

    for (const row of due) {
      if (row.kind.startsWith(DIGEST_PREFIX)) {
        const list = digestByUser.get(row.userId) ?? [];
        list.push(row);
        digestByUser.set(row.userId, list);
        continue;
      }

      if (row.loanId) {
        const loan = await repos.loans.findById(row.loanId);
        const stillRelevant =
          loan && loan.status !== 'RETURNED' && (row.kind !== 'FOLLOW_UP' || loan.needDecision === 'NOT_SURE');
        if (!stillRelevant) {
          if (await repos.scheduledNotifications.complete(row.id, 'CANCELLED', at)) skipped++;
          continue;
        }
      }

      // The *current* preference decides; the conditional `complete` is the claim,
      // so overlapping scheduler ticks never double-send.
      const sent = await this.store.transaction(async (tx) => {
        const user = await tx.users.findById(row.userId);
        const route = user ? routeFor(user.notificationPreference, row.kind) : 'SUPPRESS';
        if (route === 'SUPPRESS') {
          await tx.scheduledNotifications.complete(row.id, 'SUPPRESSED', at);
          return false;
        }
        // Already late, so a DIGEST route is delivered now rather than deferred again.
        if (!(await tx.scheduledNotifications.complete(row.id, 'SENT', at))) return false;
        await tx.notifications.create({
          userId: row.userId,
          loanId: row.loanId ?? null,
          kind: row.kind,
          title: row.title,
          message: row.message,
          read: false,
        });
        return true;
      });
      if (sent) delivered++;
      else skipped++;
    }

    for (const [userId, rows] of digestByUser) {
      const sent = await this.store.transaction(async (tx) => {
        const claimedRows: ScheduledNotification[] = [];
        for (const row of rows) {
          if (await tx.scheduledNotifications.complete(row.id, 'SENT', at)) claimedRows.push(row);
        }
        if (claimedRows.length === 0) return false;
        const lines = claimedRows.map((r) => `• ${r.title}: ${r.message}`);
        await tx.notifications.create({
          userId,
          loanId: null,
          kind: 'DIGEST',
          title: `Library digest: ${claimedRows.length} update${claimedRows.length === 1 ? '' : 's'}`,
          message: lines.join('\n'),
          read: false,
        });
        return true;
      });
      if (sent) delivered++;
    }

    return { delivered, skipped };
  }

  /**
   * Creates due-date reminders for open loans (deduplicated per day).
   * Loans marked for return get no "renew" style reminders, only the overdue warning.
   */
  public async generateDueReminders(at: Date = now()): Promise<number> {
    const repos = this.store.repos;
    const [loans, policy] = await Promise.all([repos.loans.findOpenLoans(), repos.policy.getDefaultPolicy()]);
    let created = 0;

    for (const loan of loans) {
      const days = differenceInCalendarDays(new Date(loan.dueAt), at);
      const book = await repos.books.findById(loan.bookId);
      const title = book?.title ?? 'A borrowed book';

      let reminder: { kind: string; title: string; message: string } | null = null;
      if (days < 0) {
        reminder = {
          kind: 'OVERDUE',
          title: `Overdue: ${title}`,
          message: `"${title}" is ${Math.abs(days)} day(s) overdue. A fine of ₹${policy.finePerDay.toFixed(2)}/day is accruing until it is returned.`,
        };
      } else if (loan.markedForReturn) {
        continue;
      } else if (days === 0) {
        reminder = { kind: 'DUE_TODAY', title: `Due today: ${title}`, message: `"${title}" is due back today.` };
      } else if (days <= policy.urgentMaxDays) {
        reminder = {
          kind: 'DUE_SOON',
          title: `Due soon: ${title}`,
          message: `"${title}" is due in ${days} day(s). Renew it, or decide whether you still need it.`,
        };
      }
      if (!reminder) continue;

      const result = await this.notify({ userId: loan.userId, loanId: loan.id, ...reminder, dedupeWithinMinutes: 24 * 60 });
      if (result.route === 'DELIVER' || result.route === 'DIGEST') created++;
    }
    return created;
  }
}

/** Runs the notification jobs on an interval. Each tick is non-overlapping. */
export class NotificationScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private notifications: NotificationService) {}

  async tick(at: Date = now()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.notifications.dispatchDue(at);
      await this.notifications.generateDueReminders(at);
    } catch (err) {
      console.error('[LibTrack] Notification scheduler tick failed:', err);
    } finally {
      this.running = false;
    }
  }

  start(intervalMs: number): void {
    if (intervalMs <= 0 || this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
