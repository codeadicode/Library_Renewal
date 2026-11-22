import {
  User,
  Book,
  BookCopy,
  Loan,
  Reservation,
  RenewalAttempt,
  AcademicNeed,
  Topic,
  Course,
  Notification,
  FineLedger,
  LibraryPolicy,
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
  countAvailablePhysicalCopies(bookId: string): Promise<number>;
  countAllAvailablePhysical(): Promise<Map<string, number>>;
}

export interface ILoanRepository {
  findById(id: string): Promise<Loan | null>;
  findByUserId(userId: string): Promise<Loan[]>;
  findActiveByCopyId(copyId: string): Promise<Loan | null>;
  create(data: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>): Promise<Loan>;
  update(id: string, data: Partial<Loan>): Promise<Loan>;
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
  findDuplicateRecent(userId: string, kind: string, title: string, withinMinutes: number): Promise<boolean>;
}

export interface IFineRepository {
  findByUserId(userId: string): Promise<FineLedger[]>;
  create(data: Omit<FineLedger, 'id' | 'createdAt'>): Promise<FineLedger>;
}

export interface IPolicyRepository {
  getDefaultPolicy(): Promise<LibraryPolicy>;
}

