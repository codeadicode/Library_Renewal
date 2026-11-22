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

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByStudentId(studentId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User>;
}

export interface IBookRepository {
  findAll(): Promise<Book[]>;
  findById(id: string): Promise<Book | null>;
  search(query: { q?: string; category?: string; courseId?: string; type?: string }): Promise<Book[]>;
  findTopics(): Promise<Topic[]>;
  findCourses(): Promise<Course[]>;
  findCopiesByBookId(bookId: string): Promise<BookCopy[]>;
  findCopyById(copyId: string): Promise<BookCopy | null>;
  countAvailablePhysicalCopies(bookId: string): Promise<number>;
  countAllAvailablePhysical(): Promise<Map<string, number>>;
  /**
   * Atomically moves one AVAILABLE copy of the book to `nextStatus` and returns it,
   * or null when no copy is free. Safe under concurrent borrows.
   */
  claimAvailableCopy(bookId: string, nextStatus: CopyStatus): Promise<BookCopy | null>;
  updateCopyStatus(copyId: string, status: CopyStatus): Promise<BookCopy>;
}

export interface ILoanRepository {
  findById(id: string): Promise<Loan | null>;
  findByUserId(userId: string): Promise<Loan[]>;
  findActiveByCopyId(copyId: string): Promise<Loan | null>;
  findOpenLoans(): Promise<Loan[]>;
  create(data: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>): Promise<Loan>;
  update(id: string, data: Partial<Loan>): Promise<Loan>;
  /**
   * Takes a row lock on the loan for the rest of the current transaction
   * (SELECT ... FOR UPDATE in PostgreSQL). Concurrent renewals/returns of the
   * same loan queue behind each other instead of racing.
   */
  lockForUpdate(id: string): Promise<void>;
}

export interface IReservationRepository {
  findActiveByBookId(bookId: string): Promise<Reservation[]>;
  findByUserId(userId: string): Promise<Reservation[]>;
  create(data: Omit<Reservation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Reservation>;
}

export interface IRenewalAttemptRepository {
  findByLoanId(loanId: string): Promise<RenewalAttempt[]>;
  create(data: Omit<RenewalAttempt, 'id' | 'createdAt'>): Promise<RenewalAttempt>;
}

export interface IAcademicNeedRepository {
  findByUserId(userId: string): Promise<AcademicNeed[]>;
  create(data: Omit<AcademicNeed, 'id' | 'createdAt' | 'updatedAt'>): Promise<AcademicNeed>;
  update(id: string, userId: string, data: Partial<AcademicNeed>): Promise<AcademicNeed | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface INotificationRepository {
  findByUserId(userId: string): Promise<Notification[]>;
  create(data: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification>;
  markRead(id: string, userId: string): Promise<Notification | null>;
  findDuplicateRecent(userId: string, kind: string, title: string, since: Date): Promise<boolean>;
}

export interface IScheduledNotificationRepository {
  create(
    data: Omit<ScheduledNotification, 'id' | 'createdAt' | 'status' | 'sentAt'>,
  ): Promise<ScheduledNotification>;
  findDue(asOf: Date, limit: number): Promise<ScheduledNotification[]>;
  findPendingByUserId(userId: string): Promise<ScheduledNotification[]>;
  /** Moves a PENDING row to a final status. Returns false if another worker already handled it. */
  complete(id: string, status: Exclude<ScheduledNotificationStatus, 'PENDING'>, at: Date): Promise<boolean>;
  cancelPendingForLoan(loanId: string, kind?: string): Promise<number>;
}

export interface IFineRepository {
  findByUserId(userId: string): Promise<FineLedger[]>;
  findByLoanId(loanId: string): Promise<FineLedger[]>;
  create(data: Omit<FineLedger, 'id' | 'createdAt'>): Promise<FineLedger>;
}

export interface IPolicyRepository {
  getDefaultPolicy(): Promise<LibraryPolicy>;
}

export interface Repositories {
  users: IUserRepository;
  books: IBookRepository;
  loans: ILoanRepository;
  reservations: IReservationRepository;
  renewalAttempts: IRenewalAttemptRepository;
  academicNeeds: IAcademicNeedRepository;
  notifications: INotificationRepository;
  scheduledNotifications: IScheduledNotificationRepository;
  fines: IFineRepository;
  policy: IPolicyRepository;
}

export interface DataStore {
  readonly driver: 'postgres' | 'memory';
  readonly repos: Repositories;
  /**
   * Runs `work` atomically. Every repository call made through the `tx`
   * argument commits together or not at all.
   */
  transaction<T>(work: (tx: Repositories) => Promise<T>): Promise<T>;
  ping(): Promise<void>;
  disconnect(): Promise<void>;
}
