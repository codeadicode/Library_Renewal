import { Prisma, PrismaClient } from '@prisma/client';
import {
  AcademicNeed,
  Book,
  BookCopy,
  CopyStatus,
  Course,
  FineLedger,
  LibraryPolicy,
  Loan,
  Notification,
  RenewalAttempt,
  Reservation,
  ScheduledNotification,
  ScheduledNotificationStatus,
  Topic,
  User,
} from '../types';
import {
  DataStore,
  IAcademicNeedRepository,
  IBookRepository,
  IFineRepository,
  ILoanRepository,
  INotificationRepository,
  IPolicyRepository,
  IRenewalAttemptRepository,
  IReservationRepository,
  IScheduledNotificationRepository,
  IUserRepository,
  Repositories,
} from './interfaces';
import { storedStatus, withDerivedStatus } from '../lib/loanStatus';
import { fromMinor, toMinor } from '../lib/money';

type Db = PrismaClient | Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Row -> domain mappers
// ---------------------------------------------------------------------------

const bookInclude = {
  topics: { select: { topicId: true } },
  courses: { select: { courseId: true } },
} satisfies Prisma.BookInclude;

type BookRow = Prisma.BookGetPayload<{ include: typeof bookInclude }>;

function toBook(row: BookRow): Book {
  const { topics, courses, ...rest } = row;
  return {
    ...rest,
    topicIds: topics.map((t) => t.topicId),
    courseIds: courses.map((c) => c.courseId),
  };
}

const decimalToNumber = (value: Prisma.Decimal | number): number => fromMinor(toMinor(value));

function toLoan(row: Prisma.LoanGetPayload<object>): Loan {
  return withDerivedStatus({ ...row, status: row.status });
}

function toFine(row: Prisma.FineLedgerGetPayload<object>): FineLedger {
  return { ...row, amount: decimalToNumber(row.amount) };
}

function toPolicy(row: Prisma.LibraryPolicyGetPayload<object>): LibraryPolicy {
  return { ...row, finePerDay: decimalToNumber(row.finePerDay) };
}

function toLoanWrite(data: Partial<Loan>): Prisma.LoanUncheckedUpdateInput {
  // Strip fields that are derived or immutable, and never persist OVERDUE.
  const { id: _id, createdAt: _c, updatedAt: _u, status, ...rest } = data;
  const out: Prisma.LoanUncheckedUpdateInput = { ...rest };
  const stored = storedStatus(status);
  if (stored) out.status = stored;
  return out;
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

class PrismaUserRepository implements IUserRepository {
  constructor(private db: Db) {}

  findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  findByStudentId(studentId: string): Promise<User | null> {
    return this.db.user.findFirst({
      where: { studentId: { equals: studentId.trim(), mode: 'insensitive' } },
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.db.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    });
  }

  create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    return this.db.user.create({ data });
  }

  update(id: string, data: Partial<User>): Promise<User> {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = data;
    return this.db.user.update({ where: { id }, data: rest });
  }
}

class PrismaBookRepository implements IBookRepository {
  constructor(private db: Db) {}

  async findAll(): Promise<Book[]> {
    const rows = await this.db.book.findMany({ include: bookInclude, orderBy: { title: 'asc' } });
    return rows.map(toBook);
  }

  async findById(id: string): Promise<Book | null> {
    const row = await this.db.book.findUnique({ where: { id }, include: bookInclude });
    return row ? toBook(row) : null;
  }

  async search(query: { q?: string; category?: string; courseId?: string; type?: string }): Promise<Book[]> {
    const and: Prisma.BookWhereInput[] = [];
    const q = query.q?.trim();
    if (q) {
      and.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { author: { contains: q, mode: 'insensitive' } },
          { isbn: { contains: q } },
          { category: { contains: q, mode: 'insensitive' } },
          { topics: { some: { topic: { name: { contains: q, mode: 'insensitive' } } } } },
        ],
      });
    }
    if (query.category) and.push({ category: { equals: query.category, mode: 'insensitive' } });
    if (query.courseId) and.push({ courses: { some: { courseId: query.courseId } } });
    if (query.type === 'PHYSICAL') and.push({ resourceType: { not: 'DIGITAL' } });
    else if (query.type === 'DIGITAL') and.push({ resourceType: { not: 'PHYSICAL' } });

    const rows = await this.db.book.findMany({
      where: and.length ? { AND: and } : undefined,
      include: bookInclude,
      orderBy: { title: 'asc' },
    });
    return rows.map(toBook);
  }

  findTopics(): Promise<Topic[]> {
    return this.db.topic.findMany({ orderBy: { name: 'asc' } });
  }

  findCourses(): Promise<Course[]> {
    return this.db.course.findMany({ orderBy: { code: 'asc' } });
  }

  findCopiesByBookId(bookId: string): Promise<BookCopy[]> {
    return this.db.bookCopy.findMany({ where: { bookId }, orderBy: { code: 'asc' } });
  }

  findCopyById(copyId: string): Promise<BookCopy | null> {
    return this.db.bookCopy.findUnique({ where: { id: copyId } });
  }

  countAvailablePhysicalCopies(bookId: string): Promise<number> {
    return this.db.bookCopy.count({ where: { bookId, status: 'AVAILABLE' } });
  }

  async countAllAvailablePhysical(): Promise<Map<string, number>> {
    const [books, groups] = await Promise.all([
      this.db.book.findMany({ select: { id: true } }),
      this.db.bookCopy.groupBy({ by: ['bookId'], where: { status: 'AVAILABLE' }, _count: { _all: true } }),
    ]);
    const counts = new Map<string, number>();
    books.forEach((b) => counts.set(b.id, 0));
    groups.forEach((g) => counts.set(g.bookId, g._count._all));
    return counts;
  }

  async claimAvailableCopy(bookId: string, nextStatus: CopyStatus): Promise<BookCopy | null> {
    // SKIP LOCKED lets two concurrent borrowers each take a *different* free copy
    // (or one of them gets nothing) instead of both taking the same one.
    const rows = await this.db.$queryRaw<BookCopy[]>`
      UPDATE "BookCopy"
         SET "status" = ${nextStatus}::"CopyStatus", "updatedAt" = NOW()
       WHERE "id" = (
         SELECT "id" FROM "BookCopy"
          WHERE "bookId" = ${bookId} AND "status" = 'AVAILABLE'
          ORDER BY "code"
          LIMIT 1
          FOR UPDATE SKIP LOCKED
       )
   RETURNING "id", "bookId", "code", "status", "createdAt", "updatedAt"`;
    return rows[0] ?? null;
  }

  updateCopyStatus(copyId: string, status: CopyStatus): Promise<BookCopy> {
    return this.db.bookCopy.update({ where: { id: copyId }, data: { status } });
  }
}

class PrismaLoanRepository implements ILoanRepository {
  constructor(private db: Db) {}

  async findById(id: string): Promise<Loan | null> {
    const row = await this.db.loan.findUnique({ where: { id } });
    return row ? toLoan(row) : null;
  }

  async findByUserId(userId: string): Promise<Loan[]> {
    const rows = await this.db.loan.findMany({ where: { userId }, orderBy: { dueAt: 'asc' } });
    return rows.map(toLoan);
  }

  async findActiveByCopyId(copyId: string): Promise<Loan | null> {
    const row = await this.db.loan.findFirst({ where: { copyId, status: 'ACTIVE' } });
    return row ? toLoan(row) : null;
  }

  async findOpenLoans(): Promise<Loan[]> {
    const rows = await this.db.loan.findMany({ where: { status: 'ACTIVE' } });
    return rows.map(toLoan);
  }

  async create(data: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>): Promise<Loan> {
    const row = await this.db.loan.create({
      data: { ...data, status: storedStatus(data.status) ?? 'ACTIVE' },
    });
    return toLoan(row);
  }

  async update(id: string, data: Partial<Loan>): Promise<Loan> {
    const row = await this.db.loan.update({ where: { id }, data: toLoanWrite(data) });
    return toLoan(row);
  }

  async lockForUpdate(id: string): Promise<void> {
    await this.db.$queryRaw`SELECT "id" FROM "Loan" WHERE "id" = ${id} FOR UPDATE`;
  }
}

class PrismaReservationRepository implements IReservationRepository {
  constructor(private db: Db) {}

  findActiveByBookId(bookId: string): Promise<Reservation[]> {
    return this.db.reservation.findMany({ where: { bookId, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } });
  }

  findByUserId(userId: string): Promise<Reservation[]> {
    return this.db.reservation.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  create(data: Omit<Reservation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Reservation> {
    return this.db.reservation.create({ data });
  }
}

class PrismaRenewalAttemptRepository implements IRenewalAttemptRepository {
  constructor(private db: Db) {}

  findByLoanId(loanId: string): Promise<RenewalAttempt[]> {
    return this.db.renewalAttempt.findMany({ where: { loanId }, orderBy: { createdAt: 'desc' } });
  }

  create(data: Omit<RenewalAttempt, 'id' | 'createdAt'>): Promise<RenewalAttempt> {
    return this.db.renewalAttempt.create({ data });
  }
}

class PrismaAcademicNeedRepository implements IAcademicNeedRepository {
  constructor(private db: Db) {}

  findByUserId(userId: string): Promise<AcademicNeed[]> {
    return this.db.academicNeed.findMany({ where: { userId }, orderBy: { neededUntil: 'asc' } });
  }

  create(data: Omit<AcademicNeed, 'id' | 'createdAt' | 'updatedAt'>): Promise<AcademicNeed> {
    return this.db.academicNeed.create({ data });
  }

  async update(id: string, userId: string, data: Partial<AcademicNeed>): Promise<AcademicNeed | null> {
    const { id: _id, userId: _u, createdAt: _c, updatedAt: _up, ...rest } = data;
    const result = await this.db.academicNeed.updateMany({ where: { id, userId }, data: rest });
    if (result.count === 0) return null;
    return this.db.academicNeed.findUnique({ where: { id } });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.db.academicNeed.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }
}

class PrismaNotificationRepository implements INotificationRepository {
  constructor(private db: Db) {}

  findByUserId(userId: string): Promise<Notification[]> {
    return this.db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  create(data: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    return this.db.notification.create({ data });
  }

  async markRead(id: string, userId: string): Promise<Notification | null> {
    const result = await this.db.notification.updateMany({ where: { id, userId }, data: { read: true } });
    if (result.count === 0) return null;
    return this.db.notification.findUnique({ where: { id } });
  }

  async findDuplicateRecent(userId: string, kind: string, title: string, since: Date): Promise<boolean> {
    const hit = await this.db.notification.findFirst({
      where: { userId, kind, title, createdAt: { gte: since } },
      select: { id: true },
    });
    return Boolean(hit);
  }
}

class PrismaScheduledNotificationRepository implements IScheduledNotificationRepository {
  constructor(private db: Db) {}

  create(
    data: Omit<ScheduledNotification, 'id' | 'createdAt' | 'status' | 'sentAt'>,
  ): Promise<ScheduledNotification> {
    return this.db.scheduledNotification.create({ data });
  }

  findDue(asOf: Date, limit: number): Promise<ScheduledNotification[]> {
    return this.db.scheduledNotification.findMany({
      where: { status: 'PENDING', sendAt: { lte: asOf } },
      orderBy: { sendAt: 'asc' },
      take: limit,
    });
  }

  findPendingByUserId(userId: string): Promise<ScheduledNotification[]> {
    return this.db.scheduledNotification.findMany({
      where: { userId, status: 'PENDING' },
      orderBy: { sendAt: 'asc' },
    });
  }

  async complete(
    id: string,
    status: Exclude<ScheduledNotificationStatus, 'PENDING'>,
    at: Date,
  ): Promise<boolean> {
    // Conditional update = claim. If two scheduler ticks overlap, only one wins.
    const result = await this.db.scheduledNotification.updateMany({
      where: { id, status: 'PENDING' },
      data: { status, sentAt: at },
    });
    return result.count > 0;
  }

  async cancelPendingForLoan(loanId: string, kind?: string): Promise<number> {
    const result = await this.db.scheduledNotification.updateMany({
      where: { loanId, status: 'PENDING', ...(kind ? { kind } : {}) },
      data: { status: 'CANCELLED' },
    });
    return result.count;
  }
}

class PrismaFineRepository implements IFineRepository {
  constructor(private db: Db) {}

  async findByUserId(userId: string): Promise<FineLedger[]> {
    const rows = await this.db.fineLedger.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return rows.map(toFine);
  }

  async findByLoanId(loanId: string): Promise<FineLedger[]> {
    const rows = await this.db.fineLedger.findMany({ where: { loanId } });
    return rows.map(toFine);
  }

  async create(data: Omit<FineLedger, 'id' | 'createdAt'>): Promise<FineLedger> {
    const row = await this.db.fineLedger.create({
      data: { ...data, amount: new Prisma.Decimal(fromMinor(toMinor(data.amount)).toFixed(2)) },
    });
    return toFine(row);
  }
}

class PrismaPolicyRepository implements IPolicyRepository {
  constructor(private db: Db) {}

  async getDefaultPolicy(): Promise<LibraryPolicy> {
    const row = await this.db.libraryPolicy.findFirst({
      where: { isDefault: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!row) {
      throw new Error('No default LibraryPolicy row found. Run `npm run db:seed` to load the demo data.');
    }
    return toPolicy(row);
  }
}

export function createPrismaRepositories(db: Db): Repositories {
  return {
    users: new PrismaUserRepository(db),
    books: new PrismaBookRepository(db),
    loans: new PrismaLoanRepository(db),
    reservations: new PrismaReservationRepository(db),
    renewalAttempts: new PrismaRenewalAttemptRepository(db),
    academicNeeds: new PrismaAcademicNeedRepository(db),
    notifications: new PrismaNotificationRepository(db),
    scheduledNotifications: new PrismaScheduledNotificationRepository(db),
    fines: new PrismaFineRepository(db),
    policy: new PrismaPolicyRepository(db),
  };
}

export class PrismaDataStore implements DataStore {
  public readonly driver = 'postgres' as const;
  public readonly repos: Repositories;

  constructor(public readonly prisma: PrismaClient = new PrismaClient()) {
    this.repos = createPrismaRepositories(prisma);
  }

  transaction<T>(work: (tx: Repositories) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(createPrismaRepositories(tx)), {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5_000,
      timeout: 15_000,
    });
  }

  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
