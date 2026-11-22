export const NOW = new Date('2026-11-21T09:00:00+05:30');

export type ResourceType = 'PHYSICAL' | 'DIGITAL' | 'BOTH';
export type CopyStatus = 'AVAILABLE' | 'ON_LOAN' | 'RESERVED';
export type LoanStatus = 'ACTIVE' | 'RETURNED';
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
  simulated: true;
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
  title: string;
  body: string;
  at: string;
  read: boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  reasonCode: ReasonCode;
  reason: string;
  suggestedAction: SuggestedAction;
  policyName: string;
}

export interface AlternativeMatch {
  bookId: string;
  score: number;
  matchingTopics: string[];
  reasons: string[];
  availablePhysical: number;
  digitalAccessible: boolean;
}

export interface RegisterInput {
  studentId: string;
  name: string;
  email: string;
  password: string;
  course: string;
  academicYear: string;
}
