import {
  AcademicNeed,
  ActionCentre,
  ActivityItem,
  AlternativeMatch,
  Book,
  BookDetail,
  Catalogue,
  EligibilityResult,
  FineEntry,
  FineSummary,
  LibraryPolicy,
  Loan,
  LoanFineEstimate,
  NeedDecision,
  NotificationItem,
  NotificationPreference,
  ProfilePatch,
  RegisterInput,
  RenewalAttempt,
  Reservation,
  Student,
} from '../domain/types';

export type PublicStudent = Omit<Student, 'password'>;

export interface BookQuery {
  q?: string;
  category?: string;
  courseId?: string;
  type?: string;
  available?: boolean;
}

/**
 * Everything the screens need. Implemented once against the backend
 * (httpClient.ts) and once against bundled demo data (mockStore.ts).
 * The `userId` arguments are only used by the mock; the server takes the
 * identity from the session token.
 */
export interface LibraryApi {
  mode: 'api' | 'mock';

  login(identifier: string, password: string): Promise<{ user: PublicStudent; token?: string }>;
  register(input: RegisterInput): Promise<{ user: PublicStudent; token?: string }>;
  me(userId: string): Promise<PublicStudent>;
  updatePreferences(userId: string, pref: NotificationPreference): Promise<PublicStudent>;
  updateProfile(userId: string, patch: ProfilePatch): Promise<PublicStudent>;

  getPolicy(): Promise<LibraryPolicy>;
  getCatalogue(): Promise<Catalogue>;
  listBooks(query?: BookQuery): Promise<{ books: Book[]; availableCounts: Record<string, number> }>;
  getBookDetail(id: string): Promise<BookDetail>;

  listLoans(userId: string): Promise<Loan[]>;
  getLoan(userId: string, loanId: string): Promise<Loan>;
  eligibility(userId: string, loanId: string): Promise<EligibilityResult>;
  actionCentre(userId: string): Promise<ActionCentre>;
  renewalHistory(userId: string, loanId: string): Promise<RenewalAttempt[]>;
  renew(userId: string, loanId: string): Promise<{ ok: boolean; result: EligibilityResult; loan: Loan }>;
  decide(userId: string, loanId: string, decision: NeedDecision): Promise<Loan>;
  returnLoan(userId: string, loanId: string): Promise<{ loan: Loan; fine: FineEntry | null }>;
  borrowBook(userId: string, bookId: string): Promise<Loan>;
  reserve(userId: string, bookId: string): Promise<Reservation>;
  alternatives(userId: string, bookId: string): Promise<AlternativeMatch[]>;

  listNeeds(userId: string): Promise<AcademicNeed[]>;
  addNeed(userId: string, input: Omit<AcademicNeed, 'id' | 'userId'>): Promise<AcademicNeed>;
  deleteNeed(userId: string, id: string): Promise<{ ok: boolean }>;

  getFines(userId: string): Promise<FineSummary>;
  estimateFine(userId: string, loanId: string): Promise<LoanFineEstimate>;

  listNotifications(userId: string): Promise<NotificationItem[]>;
  markNotificationRead(userId: string, id: string): Promise<void>;
  listActivity(userId: string): Promise<ActivityItem[]>;
}
