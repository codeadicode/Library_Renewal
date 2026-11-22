import { API_URL } from '../config';
import {
  AcademicContext,
  AcademicNeed,
  ActionCentre,
  ActivityItem,
  ActivityKind,
  AlternativeMatch,
  Book,
  BookDetail,
  Catalogue,
  Course,
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
  Topic,
} from '../domain/types';
import type { LibraryApi, PublicStudent } from './types';

// ---------------------------------------------------------------------------
// Session token + transport
// ---------------------------------------------------------------------------

let sessionToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const session = {
  getToken: () => sessionToken,
  setToken: (token: string | null) => {
    sessionToken = token;
  },
  /** Called when the server rejects the stored token (expired, secret rotated…). */
  onUnauthorized: (handler: (() => void) | null) => {
    unauthorizedHandler = handler;
  },
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const TIMEOUT_MS = 15_000;

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL is not set.');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, { ...options, headers, signal: controller.signal });
  } catch {
    // Deliberately no fallback to mock data: a wrong screen is worse than an honest error.
    throw new ApiError(`Cannot reach the LibTrack server at ${API_URL}. Check that the backend is running.`, 0, 'NETWORK');
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && sessionToken && !endpoint.startsWith('/api/auth/login')) {
      unauthorizedHandler?.();
    }
    throw new ApiError(data?.message || `Request failed (HTTP ${response.status})`, response.status, data?.error);
  }
  return data as T;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

// ---------------------------------------------------------------------------
// Response mappers (backend JSON → app domain types)
// ---------------------------------------------------------------------------

type Raw = Record<string, any>;

const mapAcademicContext = (c: Raw | null | undefined): AcademicContext | null =>
  c
    ? {
        needId: c.need_id,
        course: c.course,
        topic: c.topic,
        assessmentType: c.assessment_type,
        assessmentDate: c.assessment_date,
        neededUntil: c.needed_until,
        daysUntilAssessment: c.days_until_assessment,
        neededBeyondDue: c.needed_beyond_due,
        renewalCoversNeed: c.renewal_covers_need,
      }
    : null;

export const mapEligibility = (e: Raw): EligibilityResult => ({
  eligible: e.eligible,
  reasonCode: e.reason_code,
  reason: e.reason,
  suggestedAction: e.suggested_action,
  policyName: e.policy_name,
  maxRenewals: e.max_renewals,
  renewalsUsed: e.renewals_used,
  projectedDueAt: e.projected_due_at,
  academicContext: mapAcademicContext(e.academic_context),
});

const mapLoan = (l: Raw): Loan => ({
  id: l.id,
  userId: l.userId,
  copyId: l.copyId,
  bookId: l.bookId,
  issuedAt: l.issuedAt,
  dueAt: l.dueAt,
  returnedAt: l.returnedAt ?? undefined,
  status: l.status,
  renewalCount: l.renewalCount,
  needDecision: l.needDecision ?? undefined,
  followUpAt: l.followUpAt ?? undefined,
  markedForReturn: l.markedForReturn,
});

const mapBook = (b: Raw): Book => ({
  id: b.id,
  title: b.title,
  author: b.author,
  isbn: b.isbn,
  description: b.description,
  category: b.category,
  academicLevel: b.academicLevel,
  resourceType: b.resourceType,
  renewable: b.renewable,
  digitalUrl: b.digitalUrl ?? undefined,
  topicIds: b.topicIds ?? [],
  courseIds: b.courseIds ?? [],
});

const mapAttempt = (a: Raw): RenewalAttempt => ({
  id: a.id,
  loanId: a.loanId,
  at: a.createdAt,
  eligible: a.eligible,
  reasonCode: a.reasonCode,
  reason: a.reason,
  newDueAt: a.newDueAt ?? undefined,
});

const mapFine = (f: Raw): FineEntry => ({
  id: f.id,
  userId: f.userId,
  loanId: f.loanId ?? undefined,
  amount: Number(f.amount),
  reason: f.reason,
  at: f.createdAt,
});

const mapNotification = (n: Raw): NotificationItem => ({
  id: n.id,
  userId: n.userId,
  kind: n.kind,
  title: n.title,
  body: n.message ?? '',
  read: n.read,
  at: n.createdAt,
});

const mapNeed = (n: Raw): AcademicNeed => ({
  id: n.id,
  userId: n.userId,
  course: n.course,
  topic: n.topic,
  assessmentType: n.assessmentType,
  assessmentDate: String(n.assessmentDate).slice(0, 10),
  neededUntil: String(n.neededUntil).slice(0, 10),
});

const ACTIVITY_KIND: Record<string, ActivityKind> = {
  RENEWAL_SUCCESS: 'RENEWAL_SUCCESS',
  RENEWAL_BLOCKED: 'RENEWAL_FAILED',
  RETURNED: 'RETURNED',
  ISSUED: 'RESERVATION_UPDATE',
  RESERVATION: 'RESERVATION_UPDATE',
  DECISION: 'DECISION',
};

// ---------------------------------------------------------------------------
// API implementation
// ---------------------------------------------------------------------------

type AuthResponse = { user: PublicStudent; token: string };

export const httpApi: LibraryApi = {
  mode: 'api',

  async login(identifier, password) {
    const res = await apiFetch<AuthResponse>('/api/auth/login', { method: 'POST', ...json({ identifier, password }) });
    session.setToken(res.token);
    return res;
  },

  async register(input: RegisterInput) {
    const res = await apiFetch<AuthResponse>('/api/auth/register', { method: 'POST', ...json(input) });
    session.setToken(res.token);
    return res;
  },

  me: () => apiFetch<PublicStudent>('/api/auth/me'),

  updatePreferences: (_userId: string, pref: NotificationPreference) =>
    apiFetch<PublicStudent>('/api/auth/preferences', { method: 'PATCH', ...json({ notificationPreference: pref }) }),

  updateProfile: (_userId: string, patch: ProfilePatch) =>
    apiFetch<PublicStudent>('/api/auth/profile', { method: 'PATCH', ...json(patch) }),

  getPolicy: () => apiFetch<LibraryPolicy>('/api/policy'),

  async getCatalogue(): Promise<Catalogue> {
    const [books, topics, courses] = await Promise.all([
      apiFetch<{ books: Raw[]; availableCounts: Record<string, number> }>('/api/books'),
      apiFetch<Topic[]>('/api/books/topics'),
      apiFetch<Course[]>('/api/books/courses'),
    ]);
    return { books: books.books.map(mapBook), availableCounts: books.availableCounts, topics, courses };
  },

  async listBooks(query) {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.category) params.set('category', query.category);
    if (query?.courseId) params.set('courseId', query.courseId);
    if (query?.type) params.set('type', query.type);
    if (query?.available !== undefined) params.set('available', String(query.available));
    const res = await apiFetch<{ books: Raw[]; availableCounts: Record<string, number> }>(`/api/books?${params}`);
    return { books: res.books.map(mapBook), availableCounts: res.availableCounts };
  },

  async getBookDetail(id: string): Promise<BookDetail> {
    const res = await apiFetch<Raw>(`/api/books/${id}`);
    return {
      book: mapBook(res.book),
      copies: res.copies,
      availablePhysical: res.availablePhysical,
      topics: res.topics.map((t: Raw) => t.name),
      courses: res.courses.map((c: Raw) => `${c.code} ${c.name}`.trim()),
    };
  },

  async listLoans() {
    return (await apiFetch<Raw[]>('/api/loans')).map(mapLoan);
  },

  async getLoan(_userId: string, loanId: string) {
    return mapLoan(await apiFetch<Raw>(`/api/loans/${loanId}`));
  },

  async eligibility(_userId: string, loanId: string) {
    return mapEligibility(await apiFetch<Raw>(`/api/loans/${loanId}/eligibility`));
  },

  async actionCentre(): Promise<ActionCentre> {
    const res = await apiFetch<Raw>('/api/actions');
    const eligibilityByLoan: Record<string, EligibilityResult> = {};
    for (const row of res.loans) eligibilityByLoan[row.loan.id] = mapEligibility(row.eligibility);
    return {
      eligibilityByLoan,
      needsAttention: res.needsAttention.map((i: Raw) => ({
        loanId: i.loanId,
        bookId: i.bookId,
        daysRemaining: i.daysRemaining,
        actionLabel: i.actionLabel,
        why: i.why,
        eligibility: mapEligibility(i.eligibility),
        academicContext: mapAcademicContext(i.academicContext),
      })),
    };
  },

  async renewalHistory(_userId: string, loanId: string) {
    return (await apiFetch<Raw[]>(`/api/loans/${loanId}/renewal-history`)).map(mapAttempt);
  },

  async renew(_userId: string, loanId: string) {
    // The backend answers 409 for a refused renewal, with the same body shape.
    let res: Raw;
    try {
      res = await apiFetch<Raw>(`/api/loans/${loanId}/renew`, { method: 'POST' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        return { ok: false, result: await httpApi.eligibility('', loanId), loan: await httpApi.getLoan('', loanId) };
      }
      throw err;
    }
    return { ok: Boolean(res.success), result: mapEligibility(res.eligibility), loan: mapLoan(res.loan) };
  },

  async decide(_userId: string, loanId: string, decision: NeedDecision) {
    return mapLoan(await apiFetch<Raw>(`/api/loans/${loanId}/decision`, { method: 'POST', ...json({ decision }) }));
  },

  async returnLoan(_userId: string, loanId: string) {
    const res = await apiFetch<Raw>(`/api/loans/${loanId}/return`, { method: 'POST' });
    return { loan: mapLoan(res.loan), fine: res.fine ? mapFine(res.fine) : null };
  },

  async borrowBook(_userId: string, bookId: string) {
    return mapLoan(await apiFetch<Raw>(`/api/books/${bookId}/borrow`, { method: 'POST' }));
  },

  async reserve(_userId: string, bookId: string) {
    return (await apiFetch<{ reservation: Reservation }>(`/api/books/${bookId}/reserve`, { method: 'POST' })).reservation;
  },

  async alternatives(_userId: string, bookId: string): Promise<AlternativeMatch[]> {
    const res = await apiFetch<Raw>(`/api/books/${bookId}/alternatives`);
    return res.recommendations.map((r: Raw) => ({
      bookId: r.book.id,
      book: mapBook(r.book),
      score: r.score,
      matchingTopics: r.matching_topics,
      reasons: r.reasons,
      availablePhysical: r.available_physical,
      digitalAccessible: r.digital_accessible,
    }));
  },

  async listNeeds() {
    return (await apiFetch<Raw[]>('/api/academic-needs')).map(mapNeed);
  },

  async addNeed(_userId: string, input) {
    return mapNeed(await apiFetch<Raw>('/api/academic-needs', { method: 'POST', ...json(input) }));
  },

  async deleteNeed(_userId: string, id: string) {
    await apiFetch(`/api/academic-needs/${id}`, { method: 'DELETE' });
    return { ok: true };
  },

  async getFines(): Promise<FineSummary> {
    const res = await apiFetch<Raw>('/api/fines');
    return {
      dailyRate: Number(res.dailyRate),
      ledger: { total: Number(res.ledger.total), entries: res.ledger.entries.map(mapFine) },
      estimates: { total: Number(res.estimates.total), loans: res.estimates.loans },
    };
  },

  estimateFine: (_userId: string, loanId: string) => apiFetch<LoanFineEstimate>(`/api/fines/estimate/${loanId}`),

  async listNotifications() {
    return (await apiFetch<Raw[]>('/api/notifications')).map(mapNotification);
  },

  async markNotificationRead(_userId: string, id: string) {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
  },

  async listActivity(): Promise<ActivityItem[]> {
    const items = (await apiFetch<Raw[]>('/api/notifications')).map(mapNotification);
    return items.slice(0, 12).map((n) => ({
      id: n.id,
      userId: n.userId,
      at: n.at,
      kind: ACTIVITY_KIND[n.kind] ?? 'REMINDER',
      title: n.title,
      detail: n.body,
    }));
  },
};

export type { Student };
