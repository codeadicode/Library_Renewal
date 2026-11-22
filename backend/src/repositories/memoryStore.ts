import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  User,
  Book,
  BookCopy,
  CopyStatus,
  Loan,
  Reservation,
  RenewalAttempt,
  AcademicNeed,
  Topic,
  Course,
  Notification,
  FineLedger,
  LibraryPolicy,
  ScheduledNotification,
  ScheduledNotificationStatus,
} from '../types';
import {
  DataStore,
  IUserRepository,
  IBookRepository,
  ILoanRepository,
  IReservationRepository,
  IRenewalAttemptRepository,
  IAcademicNeedRepository,
  INotificationRepository,
  IScheduledNotificationRepository,
  IFineRepository,
  IPolicyRepository,
  Repositories,
} from './interfaces';
import {
  DEMO_PASSWORD,
  buildDemoCirculation,
  demoBooks,
  demoCopies,
  demoCourses,
  demoPolicy,
  demoStudents,
  demoTopics,
} from '../data/demoData';
import { now } from '../lib/clock';
import { storedStatus, withDerivedStatus } from '../lib/loanStatus';

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

/** Process-local data used by unit tests and DATA_STORE=memory. Not persistent. */
export class MemoryStore {
  public users: Map<string, User> = new Map();
  public books: Map<string, Book> = new Map();
  public copies: Map<string, BookCopy> = new Map();
  public loans: Map<string, Loan> = new Map();
  public reservations: Map<string, Reservation> = new Map();
  public renewalAttempts: RenewalAttempt[] = [];
  public academicNeeds: Map<string, AcademicNeed> = new Map();
  public topics: Map<string, Topic> = new Map();
  public courses: Map<string, Course> = new Map();
  public notifications: Notification[] = [];
  public scheduledNotifications: ScheduledNotification[] = [];
  public fines: FineLedger[] = [];
  public policy: LibraryPolicy;

  constructor(anchor: Date = now()) {
    const created = new Date(anchor.getTime());
    this.policy = { ...demoPolicy, createdAt: created, updatedAt: created };

    demoTopics.forEach((t) => this.topics.set(t.id, { ...t }));
    demoCourses.forEach((c) => this.courses.set(c.id, { ...c }));

    const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 8);
    demoStudents.forEach((s) =>
      this.users.set(s.id, { ...s, passwordHash, createdAt: created, updatedAt: created }),
    );
    demoBooks.forEach((b) =>
      this.books.set(b.id, {
        ...b,
        topicIds: [...b.topicIds],
        courseIds: [...b.courseIds],
        createdAt: created,
        updatedAt: created,
      }),
    );

    const circulation = buildDemoCirculation(anchor);
    demoCopies.forEach((c) =>
      this.copies.set(c.id, {
        ...c,
        status: circulation.copyStatus[c.id] ?? 'AVAILABLE',
        createdAt: created,
        updatedAt: created,
      }),
    );
    circulation.loans.forEach((l) => this.loans.set(l.id, { ...l, createdAt: l.issuedAt, updatedAt: created }));
    circulation.reservations.forEach((r) =>
      this.reservations.set(r.id, { ...r, createdAt: created, updatedAt: created }),
    );
    this.renewalAttempts = circulation.renewalAttempts.map((a) => ({ ...a }));
    circulation.academicNeeds.forEach((n) =>
      this.academicNeeds.set(n.id, { ...n, createdAt: created, updatedAt: created }),
    );
    this.fines = circulation.fines.map((f) => ({ ...f }));
    this.notifications = circulation.notifications.map((n) => ({ ...n }));
  }

  /** Deep copy of all mutable state, used to roll back a failed transaction. */
  snapshot() {
    return structuredClone({
      users: this.users,
      books: this.books,
      copies: this.copies,
      loans: this.loans,
      reservations: this.reservations,
      renewalAttempts: this.renewalAttempts,
      academicNeeds: this.academicNeeds,
      notifications: this.notifications,
      scheduledNotifications: this.scheduledNotifications,
      fines: this.fines,
      policy: this.policy,
    });
  }

  restore(state: ReturnType<MemoryStore['snapshot']>) {
    Object.assign(this, state);
  }
}

export class MemoryUserRepository implements IUserRepository {
  constructor(private store: MemoryStore) {}

  async findById(id: string): Promise<User | null> {
    return this.store.users.get(id) || null;
  }

  async findByStudentId(studentId: string): Promise<User | null> {
    const key = studentId.trim().toLowerCase();
    for (const u of this.store.users.values()) {
      if (u.studentId.toLowerCase() === key) return u;
    }
    return null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const key = email.trim().toLowerCase();
    for (const u of this.store.users.values()) {
      if (u.email.toLowerCase() === key) return u;
    }
    return null;
  }

  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const at = now();
    const user: User = { ...data, id: newId('u'), createdAt: at, updatedAt: at };
    this.store.users.set(user.id, user);
    return user;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const user = this.store.users.get(id);
    if (!user) throw new Error('User not found');
    const updated = { ...user, ...data, id, updatedAt: now() };
    this.store.users.set(id, updated);
    return updated;
  }
}

export class MemoryBookRepository implements IBookRepository {
  constructor(private store: MemoryStore) {}

  async findAll(): Promise<Book[]> {
    return Array.from(this.store.books.values());
  }

  async findById(id: string): Promise<Book | null> {
    return this.store.books.get(id) || null;
  }

  async search(query: { q?: string; category?: string; courseId?: string; type?: string }): Promise<Book[]> {
    let list = Array.from(this.store.books.values());
    if (query.q) {
      const q = query.q.toLowerCase().trim();
      list = list.filter((b) => {
        const topicNames = b.topicIds
          .map((id) => this.store.topics.get(id)?.name.toLowerCase() || '')
          .join(' ');
        return (
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.isbn.includes(q) ||
          b.category.toLowerCase().includes(q) ||
          topicNames.includes(q)
        );
      });
    }
    if (query.category) {
      list = list.filter((b) => b.category.toLowerCase() === query.category!.toLowerCase());
    }
    if (query.courseId) {
      list = list.filter((b) => b.courseIds.includes(query.courseId!));
    }
    if (query.type === 'PHYSICAL') {
      list = list.filter((b) => b.resourceType !== 'DIGITAL');
    } else if (query.type === 'DIGITAL') {
      list = list.filter((b) => b.resourceType !== 'PHYSICAL');
    }
    return list;
  }

  async findTopics(): Promise<Topic[]> {
    return Array.from(this.store.topics.values());
  }

  async findCourses(): Promise<Course[]> {
    return Array.from(this.store.courses.values());
  }

  async findCopiesByBookId(bookId: string): Promise<BookCopy[]> {
    return Array.from(this.store.copies.values()).filter((c) => c.bookId === bookId);
  }

  async findCopyById(copyId: string): Promise<BookCopy | null> {
    return this.store.copies.get(copyId) || null;
  }

  async countAvailablePhysicalCopies(bookId: string): Promise<number> {
    return Array.from(this.store.copies.values()).filter(
      (c) => c.bookId === bookId && c.status === 'AVAILABLE',
    ).length;
  }

  async countAllAvailablePhysical(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const b of this.store.books.values()) counts.set(b.id, 0);
    for (const copy of this.store.copies.values()) {
      if (copy.status === 'AVAILABLE') counts.set(copy.bookId, (counts.get(copy.bookId) || 0) + 1);
    }
    return counts;
  }

  async claimAvailableCopy(bookId: string, nextStatus: CopyStatus): Promise<BookCopy | null> {
    const copy = Array.from(this.store.copies.values()).find(
      (c) => c.bookId === bookId && c.status === 'AVAILABLE',
    );
    if (!copy) return null;
    const updated = { ...copy, status: nextStatus, updatedAt: now() };
    this.store.copies.set(copy.id, updated);
    return updated;
  }

  async updateCopyStatus(copyId: string, status: CopyStatus): Promise<BookCopy> {
    const copy = this.store.copies.get(copyId);
    if (!copy) throw new Error('Copy not found');
    const updated = { ...copy, status, updatedAt: now() };
    this.store.copies.set(copyId, updated);
    return updated;
  }
}

export class MemoryLoanRepository implements ILoanRepository {
  constructor(private store: MemoryStore) {}

  async findById(id: string): Promise<Loan | null> {
    const loan = this.store.loans.get(id);
    return loan ? withDerivedStatus(loan) : null;
  }

  async findByUserId(userId: string): Promise<Loan[]> {
    return Array.from(this.store.loans.values())
      .filter((l) => l.userId === userId)
      .map((l) => withDerivedStatus(l));
  }

  async findActiveByCopyId(copyId: string): Promise<Loan | null> {
    for (const l of this.store.loans.values()) {
      if (l.copyId === copyId && l.status !== 'RETURNED') return withDerivedStatus(l);
    }
    return null;
  }

  async findOpenLoans(): Promise<Loan[]> {
    return Array.from(this.store.loans.values())
      .filter((l) => l.status !== 'RETURNED')
      .map((l) => withDerivedStatus(l));
  }

  async create(data: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>): Promise<Loan> {
    const at = now();
    const loan: Loan = {
      ...data,
      status: storedStatus(data.status)!,
      id: newId('l'),
      createdAt: at,
      updatedAt: at,
    };
    this.store.loans.set(loan.id, loan);
    return withDerivedStatus(loan);
  }

  async update(id: string, data: Partial<Loan>): Promise<Loan> {
    const loan = this.store.loans.get(id);
    if (!loan) throw new Error('Loan not found');
    const patch: Partial<Loan> = { ...data };
    if (data.status !== undefined) patch.status = storedStatus(data.status);
    const updated = { ...loan, ...patch, id, updatedAt: now() };
    this.store.loans.set(id, updated);
    return withDerivedStatus(updated);
  }

  async lockForUpdate(_id: string): Promise<void> {
    // MemoryDataStore.transaction already serialises every transaction.
  }
}

export class MemoryReservationRepository implements IReservationRepository {
  constructor(private store: MemoryStore) {}

  async findActiveByBookId(bookId: string): Promise<Reservation[]> {
    return Array.from(this.store.reservations.values()).filter(
      (r) => r.bookId === bookId && r.status === 'ACTIVE',
    );
  }

  async findByUserId(userId: string): Promise<Reservation[]> {
    return Array.from(this.store.reservations.values()).filter((r) => r.userId === userId);
  }

  async create(data: Omit<Reservation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Reservation> {
    const at = now();
    const res: Reservation = { ...data, id: newId('r'), createdAt: at, updatedAt: at };
    this.store.reservations.set(res.id, res);
    return res;
  }
}

export class MemoryRenewalAttemptRepository implements IRenewalAttemptRepository {
  constructor(private store: MemoryStore) {}

  async findByLoanId(loanId: string): Promise<RenewalAttempt[]> {
    return this.store.renewalAttempts
      .filter((a) => a.loanId === loanId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async create(data: Omit<RenewalAttempt, 'id' | 'createdAt'>): Promise<RenewalAttempt> {
    const attempt: RenewalAttempt = { ...data, id: newId('ra'), createdAt: now() };
    this.store.renewalAttempts.unshift(attempt);
    return attempt;
  }
}

export class MemoryAcademicNeedRepository implements IAcademicNeedRepository {
  constructor(private store: MemoryStore) {}

  async findByUserId(userId: string): Promise<AcademicNeed[]> {
    return Array.from(this.store.academicNeeds.values()).filter((n) => n.userId === userId);
  }

  async create(data: Omit<AcademicNeed, 'id' | 'createdAt' | 'updatedAt'>): Promise<AcademicNeed> {
    const at = now();
    const need: AcademicNeed = { ...data, id: newId('need'), createdAt: at, updatedAt: at };
    this.store.academicNeeds.set(need.id, need);
    return need;
  }

  async update(id: string, userId: string, data: Partial<AcademicNeed>): Promise<AcademicNeed | null> {
    const need = this.store.academicNeeds.get(id);
    if (!need || need.userId !== userId) return null;
    const updated = { ...need, ...data, id, userId, updatedAt: now() };
    this.store.academicNeeds.set(id, updated);
    return updated;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const need = this.store.academicNeeds.get(id);
    if (!need || need.userId !== userId) return false;
    return this.store.academicNeeds.delete(id);
  }
}

export class MemoryNotificationRepository implements INotificationRepository {
  constructor(private store: MemoryStore) {}

  async findByUserId(userId: string): Promise<Notification[]> {
    return this.store.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async create(data: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    const notif: Notification = { loanId: null, ...data, id: newId('notif'), createdAt: now() };
    this.store.notifications.unshift(notif);
    return notif;
  }

  async markRead(id: string, userId: string): Promise<Notification | null> {
    const notif = this.store.notifications.find((n) => n.id === id && n.userId === userId);
    if (notif) notif.read = true;
    return notif || null;
  }

  async findDuplicateRecent(userId: string, kind: string, title: string, since: Date): Promise<boolean> {
    return this.store.notifications.some(
      (n) => n.userId === userId && n.kind === kind && n.title === title && n.createdAt >= since,
    );
  }
}

export class MemoryScheduledNotificationRepository implements IScheduledNotificationRepository {
  constructor(private store: MemoryStore) {}

  async create(
    data: Omit<ScheduledNotification, 'id' | 'createdAt' | 'status' | 'sentAt'>,
  ): Promise<ScheduledNotification> {
    const row: ScheduledNotification = {
      loanId: null,
      ...data,
      id: newId('sched'),
      status: 'PENDING',
      sentAt: null,
      createdAt: now(),
    };
    this.store.scheduledNotifications.push(row);
    return row;
  }

  async findDue(asOf: Date, limit: number): Promise<ScheduledNotification[]> {
    return this.store.scheduledNotifications
      .filter((s) => s.status === 'PENDING' && s.sendAt <= asOf)
      .sort((a, b) => a.sendAt.getTime() - b.sendAt.getTime())
      .slice(0, limit);
  }

  async findPendingByUserId(userId: string): Promise<ScheduledNotification[]> {
    return this.store.scheduledNotifications.filter((s) => s.userId === userId && s.status === 'PENDING');
  }

  async complete(
    id: string,
    status: Exclude<ScheduledNotificationStatus, 'PENDING'>,
    at: Date,
  ): Promise<boolean> {
    const row = this.store.scheduledNotifications.find((s) => s.id === id);
    if (!row || row.status !== 'PENDING') return false;
    row.status = status;
    row.sentAt = at;
    return true;
  }

  async cancelPendingForLoan(loanId: string, kind?: string): Promise<number> {
    let count = 0;
    for (const row of this.store.scheduledNotifications) {
      if (row.loanId === loanId && row.status === 'PENDING' && (!kind || row.kind === kind)) {
        row.status = 'CANCELLED';
        count++;
      }
    }
    return count;
  }
}

export class MemoryFineRepository implements IFineRepository {
  constructor(private store: MemoryStore) {}

  async findByUserId(userId: string): Promise<FineLedger[]> {
    return this.store.fines.filter((f) => f.userId === userId);
  }

  async findByLoanId(loanId: string): Promise<FineLedger[]> {
    return this.store.fines.filter((f) => f.loanId === loanId);
  }

  async create(data: Omit<FineLedger, 'id' | 'createdAt'>): Promise<FineLedger> {
    const fine: FineLedger = { ...data, id: newId('fine'), createdAt: now() };
    this.store.fines.unshift(fine);
    return fine;
  }
}

export class MemoryPolicyRepository implements IPolicyRepository {
  constructor(private store: MemoryStore) {}

  async getDefaultPolicy(): Promise<LibraryPolicy> {
    return this.store.policy;
  }
}

/**
 * Memory-backed DataStore. Transactions are serialised through a promise
 * queue (so concurrent renewals cannot interleave) and roll back to a
 * snapshot if the work throws.
 *
 * Repositories read `this.store` lazily, so they keep working after a
 * rollback replaces the store's collections.
 */
export class MemoryDataStore implements DataStore {
  public readonly driver = 'memory' as const;
  public readonly repos: Repositories;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(public readonly store: MemoryStore = new MemoryStore()) {
    this.repos = {
      users: new MemoryUserRepository(store),
      books: new MemoryBookRepository(store),
      loans: new MemoryLoanRepository(store),
      reservations: new MemoryReservationRepository(store),
      renewalAttempts: new MemoryRenewalAttemptRepository(store),
      academicNeeds: new MemoryAcademicNeedRepository(store),
      notifications: new MemoryNotificationRepository(store),
      scheduledNotifications: new MemoryScheduledNotificationRepository(store),
      fines: new MemoryFineRepository(store),
      policy: new MemoryPolicyRepository(store),
    };
  }

  transaction<T>(work: (tx: Repositories) => Promise<T>): Promise<T> {
    const run = async () => {
      const before = this.store.snapshot();
      try {
        return await work(this.repos);
      } catch (err) {
        this.store.restore(before);
        throw err;
      }
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  async ping(): Promise<void> {}

  async disconnect(): Promise<void> {}
}
