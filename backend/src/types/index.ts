export type CopyStatus = 'AVAILABLE' | 'ON_LOAN' | 'RESERVED' | 'MAINTENANCE';
/**
 * Stored loan states are ACTIVE and RETURNED. OVERDUE is *derived* from the due
 * date whenever a loan is read (see lib/loanStatus.ts) so it can never go stale.
 */
export type LoanStatus = 'ACTIVE' | 'RETURNED' | 'OVERDUE';
export type ReservationStatus = 'ACTIVE' | 'FULFILLED' | 'CANCELLED';
export type NeedDecision = 'STILL_NEED' | 'DONE' | 'NOT_SURE';
export type NotificationPreference = 'DIGEST' | 'IMPORTANT' | 'NORMAL' | 'QUIET';
export type ResourceType = 'PHYSICAL' | 'DIGITAL' | 'BOTH';
export type AssessmentType = 'EXAM' | 'ASSIGNMENT' | 'PROJECT' | 'INTERNAL' | 'OTHER';

export interface User {
  id: string;
  studentId: string;
  name: string;
  email: string;
  passwordHash: string;
  course: string;
  academicYear: string;
  restricted: boolean;
  notificationPreference: NotificationPreference;
  createdAt: Date;
  updatedAt: Date;
}

export type SafeUser = Omit<User, 'passwordHash'>;

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
  digitalUrl?: string | null;
  topicIds: string[];
  courseIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BookCopy {
  id: string;
  bookId: string;
  code: string;
  status: CopyStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Loan {
  id: string;
  copyId: string;
  userId: string;
  bookId: string;
  issuedAt: Date;
  dueAt: Date;
  returnedAt?: Date | null;
  status: LoanStatus;
  renewalCount: number;
  markedForReturn: boolean;
  needDecision?: NeedDecision | null;
  followUpAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reservation {
  id: string;
  bookId: string;
  userId: string;
  status: ReservationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface RenewalAttempt {
  id: string;
  loanId: string;
  eligible: boolean;
  reasonCode: string;
  reason: string;
  newDueAt?: Date | null;
  createdAt: Date;
}

export interface AcademicNeed {
  id: string;
  userId: string;
  course: string;
  topic: string;
  assessmentType: AssessmentType;
  assessmentDate: Date;
  neededUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Topic {
  id: string;
  name: string;
  description?: string | null;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  department?: string | null;
}

export type NotificationPriority = 'HIGH' | 'NORMAL' | 'LOW';

export interface Notification {
  id: string;
  userId: string;
  loanId?: string | null;
  title: string;
  message: string;
  kind: string;
  read: boolean;
  createdAt: Date;
}

export type ScheduledNotificationStatus = 'PENDING' | 'SENT' | 'CANCELLED' | 'SUPPRESSED';

/** A notification that will be delivered later (follow-ups, digests). Persisted so it survives restarts. */
export interface ScheduledNotification {
  id: string;
  userId: string;
  loanId?: string | null;
  kind: string;
  title: string;
  message: string;
  sendAt: Date;
  status: ScheduledNotificationStatus;
  sentAt?: Date | null;
  createdAt: Date;
}

export interface FineLedger {
  id: string;
  userId: string;
  loanId?: string | null;
  amount: number;
  reason: string;
  createdAt: Date;
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
  weightMetadata: number;
  weightTfidf: number;
  weightCourse: number;
  weightLevel: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type EligibilityReasonCode =
  | 'ELIGIBLE'
  | 'LOAN_RETURNED'
  | 'LOAN_OVERDUE'
  | 'ACCOUNT_RESTRICTED'
  | 'ITEM_NOT_RENEWABLE'
  | 'ACTIVE_RESERVATION'
  | 'MAX_RENEWALS_REACHED';

/** How the student's academic plan relates to this loan. */
export interface AcademicContext {
  need_id: string;
  course: string;
  topic: string;
  assessment_type: AssessmentType;
  assessment_date: string;
  needed_until: string;
  days_until_assessment: number;
  /** Loan due date falls before the date the student says they need the material until. */
  needed_beyond_due: boolean;
  /** Only set when a renewal is possible: would the renewed due date cover the need? */
  renewal_covers_need?: boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  reason_code: EligibilityReasonCode;
  reason: string;
  suggested_action: 'RENEW' | 'FIND_ALTERNATIVE' | 'RETURN' | 'NONE';
  policy_name: string;
  max_renewals: number;
  renewals_used: number;
  current_due_at: string;
  projected_due_at?: string;
  academic_context?: AcademicContext | null;
}

export interface AlternativeRecommendation {
  book: Book;
  score: number;
  metadata_score: number;
  tfidf_score: number;
  course_score: number;
  level_score: number;
  matching_topics: string[];
  reasons: string[];
  available_physical: number;
  digital_accessible: boolean;
  format: ResourceType;
}

