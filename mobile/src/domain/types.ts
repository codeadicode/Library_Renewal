export type ResourceType = 'PHYSICAL' | 'DIGITAL' | 'BOTH';
export type CopyStatus = 'AVAILABLE' | 'ON_LOAN' | 'RESERVED' | 'MAINTENANCE';
/** OVERDUE is derived by the backend from the due date; treat ACTIVE and OVERDUE as open loans. */
export type LoanStatus = 'ACTIVE' | 'OVERDUE' | 'RETURNED';
export type NeedDecision = 'STILL_NEED' | 'DONE' | 'NOT_SURE';
export type NotificationPreference = 'DIGEST' | 'IMPORTANT' | 'NORMAL' | 'QUIET';
export type AssessmentType = 'EXAM' | 'ASSIGNMENT' | 'PROJECT' | 'INTERNAL' | 'OTHER';
export type ActivityKind =
  | 'RENEWAL_SUCCESS'
  | 'RENEWAL_FAILED'
  | 'RETURNED'
  | 'RESERVATION_UPDATE'
  | 'REMINDER'
  | 'DECISION';

export type ReasonCode =
  | 'ELIGIBLE'
  | 'LOAN_RETURNED'
  | 'MAX_RENEWALS_REACHED'
  | 'ACTIVE_RESERVATION'
  | 'ITEM_NOT_RENEWABLE'
  | 'ACCOUNT_RESTRICTED'
  | 'LOAN_OVERDUE'
  | 'RENEWAL_SUCCESS';

export type SuggestedAction = 'RENEW' | 'FIND_ALTERNATIVE' | 'RETURN' | 'NONE';

export type BookFilter = 'ISSUED' | 'DUE_SOON' | 'OVERDUE' | 'RETURNED';

export interface ProfilePatch {
  name?: string;
  email?: string;
  course?: string;
  academicYear?: string;
}

export interface LibraryPolicy {
  id: string;
  name: string;
  maxRenewals: number;
  loanPeriodDays: number;
  renewalPeriodDays: number;
  upcomingDays: number;
  approachingMinDays: number;
  approachingMaxDays: number;
  urgentMaxDays: number;
  finePerDay: number;
  recommendationWeights: {
    metadata: number;
    tfidf: number;
    course: number;
    level: number;
  };
}

export interface Student {
  id: string;
  studentId: string;
  name: string;
  email: string;
  password: string;
  course: string;
  academicYear: string;
  restricted: boolean;
  notificationPreference: NotificationPreference;
}

export interface Topic {
  id: string;
  name: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  description: string;
  category: string;
  academicLevel: string;
  resourceType: ResourceType;
  renewable: boolean;
  digitalUrl?: string;
  topicIds: string[];
  courseIds: string[];
}

export interface BookCopy {
  id: string;
  bookId: string;
  code: string;
  status: CopyStatus;
}

export interface Reservation {
  id: string;
  bookId: string;
  userId: string;
  status: 'ACTIVE' | 'FULFILLED' | 'CANCELLED';
}

export interface Loan {
  id: string;
  userId: string;
  copyId: string;
  bookId: string;
  issuedAt: string;
  dueAt: string;
  returnedAt?: string;
  status: LoanStatus;
  renewalCount: number;
  needDecision?: NeedDecision;
  followUpAt?: string;
  markedForReturn: boolean;
}

export interface RenewalAttempt {
  id: string;
  loanId: string;
  at: string;
  eligible: boolean;
  reasonCode: ReasonCode;
  reason: string;
  newDueAt?: string;
}

export interface AcademicNeed {
  id: string;
  userId: string;
  course: string;
  topic: string;
  assessmentType: AssessmentType;
  assessmentDate: string;
  neededUntil: string;
}

export interface FineEntry {
  id: string;
  userId: string;
  loanId?: string;
  amount: number;
  reason: string;
  at: string;
}

export interface FineEstimate {
  loanId: string;
  bookId: string;
  bookTitle: string;
  daysOverdue: number;
  estimatedFine: number;
}

/** Recorded ledger charges (owed) and estimates for open overdue loans (not owed yet) are kept apart. */
export interface FineSummary {
  dailyRate: number;
  ledger: { total: number; entries: FineEntry[] };
  estimates: { total: number; loans: FineEstimate[] };
}

export interface LoanFineEstimate {
  daysLate: number;
  estimatedAmount: number;
  dailyRate: number;
  returned: boolean;
  recordedAmount: number;
  calculation: string;
}

export interface ActivityItem {
  id: string;
  userId: string;
  at: string;
  kind: ActivityKind;
  title: string;
  detail: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
}

export interface AcademicContext {
  needId: string;
  course: string;
  topic: string;
  assessmentType: AssessmentType;
  assessmentDate: string;
  neededUntil: string;
  daysUntilAssessment: number;
  /** The book is needed after its current due date. */
  neededBeyondDue: boolean;
  /** Only known when renewal is possible: would one renewal cover the need? */
  renewalCoversNeed?: boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  reasonCode: ReasonCode;
  reason: string;
  suggestedAction: SuggestedAction;
  policyName: string;
  maxRenewals?: number;
  renewalsUsed?: number;
  projectedDueAt?: string;
  academicContext?: AcademicContext | null;
}

export interface ActionItem {
  loanId: string;
  bookId: string;
  daysRemaining: number;
  actionLabel: string;
  why: string;
  eligibility: EligibilityResult;
  academicContext: AcademicContext | null;
}

/** Dashboard feed. Eligibility comes from the backend in API mode. */
export interface ActionCentre {
  needsAttention: ActionItem[];
  eligibilityByLoan: Record<string, EligibilityResult>;
}

export interface AlternativeMatch {
  bookId: string;
  /** Present in API mode, where the catalogue entry comes back with the match. */
  book?: Book;
  score: number;
  matchingTopics: string[];
  reasons: string[];
  availablePhysical: number;
  digitalAccessible: boolean;
}

export interface Catalogue {
  books: Book[];
  availableCounts: Record<string, number>;
  topics: Topic[];
  courses: Course[];
}

export interface BookDetail {
  book: Book;
  copies: BookCopy[];
  availablePhysical: number;
  topics: string[];
  courses: string[];
}

export interface RegisterInput {
  studentId: string;
  name: string;
  email: string;
  password: string;
  course: string;
  academicYear: string;
}
