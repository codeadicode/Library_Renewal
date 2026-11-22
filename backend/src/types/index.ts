export type CopyStatus = 'AVAILABLE' | 'ON_LOAN' | 'RESERVED' | 'MAINTENANCE';
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

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  kind: string;
  read: boolean;
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

export interface EligibilityResult {
  eligible: boolean;
  reason_code: string;
  reason: string;
  suggested_action: 'RENEW' | 'FIND_ALTERNATIVE' | 'RETURN';
  policy_name: string;
  max_renewals: number;
  renewals_used: number;
  current_due_at: string;
  projected_due_at?: string;
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

