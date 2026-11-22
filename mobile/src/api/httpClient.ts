import {
  AcademicNeed,
  AlternativeMatch,
  Book,
  BookCopy,
  EligibilityResult,
  FineEntry,
  Loan,
  NeedDecision,
  NotificationItem,
  NotificationPreference,
  ProfilePatch,
  RegisterInput,
  RenewalAttempt,
  Reservation,
  Student,
} from '../domain/types';

// Reads configured API base URL from EXPO_PUBLIC_API_URL or defaults to localhost/emulator
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

let storedToken: string | null = null;

export const tokenStorage = {
  getToken: () => storedToken,
  setToken: (token: string | null) => {
    storedToken = token;
  },
};

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!BACKEND_URL) {
    throw new Error('BACKEND_NOT_CONFIGURED');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (storedToken) {
    headers['Authorization'] = `Bearer ${storedToken}`;
  }

  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.message || `HTTP ${response.status}: Request failed`;
    const err = new Error(errorMsg);
    (err as any).status = response.status;
    (err as any).code = data?.error;
    throw err;
  }

  return data as T;
}

export const httpClient = {
  isConfigured: () => Boolean(BACKEND_URL),

  async login(identifier: string, password: string): Promise<Omit<Student, 'password'>> {
    const res = await apiFetch<{ user: Omit<Student, 'password'>; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    tokenStorage.setToken(res.token);
    return res.user;
  },

  async register(input: RegisterInput): Promise<Omit<Student, 'password'>> {
    const res = await apiFetch<{ user: Omit<Student, 'password'>; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    tokenStorage.setToken(res.token);
    return res.user;
  },

  async me(): Promise<Omit<Student, 'password'>> {
    return apiFetch<Omit<Student, 'password'>>('/api/auth/me');
  },

  async updatePreferences(pref: NotificationPreference): Promise<Omit<Student, 'password'>> {
    return apiFetch<Omit<Student, 'password'>>('/api/auth/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ notificationPreference: pref }),
    });
  },

  async updateProfile(patch: ProfilePatch): Promise<Omit<Student, 'password'>> {
    return apiFetch<Omit<Student, 'password'>>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  async listLoans(): Promise<Loan[]> {
    return apiFetch<Loan[]>('/api/loans');
  },

  async getLoan(loanId: string): Promise<Loan> {
    return apiFetch<Loan>(`/api/loans/${loanId}`);
  },

  async checkEligibility(loanId: string): Promise<EligibilityResult> {
    return apiFetch<EligibilityResult>(`/api/loans/${loanId}/eligibility`);
  },

  async renew(loanId: string): Promise<{ ok: boolean; result: EligibilityResult; loan: Loan; attempt: RenewalAttempt }> {
    const res = await apiFetch<any>(`/api/loans/${loanId}/renew`, {
      method: 'POST',
    });
    return {
      ok: res.success,
      result: res.eligibility,
      loan: res.loan,
      attempt: res.attempt,
    };
  },

  async decide(loanId: string, decision: NeedDecision): Promise<Loan> {
    return apiFetch<Loan>(`/api/loans/${loanId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    });
  },

  async renewalHistory(loanId: string): Promise<RenewalAttempt[]> {
    return apiFetch<RenewalAttempt[]>(`/api/loans/${loanId}/renewal-history`);
  },

  async listBooks(query?: { q?: string; category?: string; available?: boolean; type?: string }): Promise<Book[]> {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.category) params.set('category', query.category);
    if (query?.type) params.set('type', query.type);
    if (query?.available !== undefined) params.set('available', String(query.available));

    const res = await apiFetch<{ books: Book[] }>(`/api/books?${params.toString()}`);
    return res.books;
  },

  async getBookDetail(id: string): Promise<{
    book: Book;
    copies: BookCopy[];
    availablePhysical: number;
    topics: string[];
    courses: string[];
  }> {
    const res = await apiFetch<any>(`/api/books/${id}`);
    return {
      book: res.book,
      copies: res.copies,
      availablePhysical: res.availablePhysical,
      topics: res.topics.map((t: any) => t.name || t),
      courses: res.courses.map((c: any) => `${c.code || ''} ${c.name || ''}`.trim()),
    };
  },

  async reserve(bookId: string): Promise<Reservation> {
    const res = await apiFetch<any>(`/api/books/${bookId}/reserve`, {
      method: 'POST',
    });
    return res.reservation;
  },

  async alternatives(bookId: string): Promise<AlternativeMatch[]> {
    const res = await apiFetch<any>(`/api/books/${bookId}/alternatives`);
    return res.recommendations.map((r: any) => ({
      bookId: r.book.id,
      score: r.score,
      matchingTopics: r.matching_topics,
      reasons: r.reasons,
      availablePhysical: r.available_physical,
      digitalAccessible: r.digital_accessible,
    }));
  },

  async listNeeds(): Promise<AcademicNeed[]> {
    return apiFetch<AcademicNeed[]>('/api/academic-needs');
  },

  async addNeed(input: Omit<AcademicNeed, 'id' | 'userId'>): Promise<AcademicNeed> {
    return apiFetch<AcademicNeed>('/api/academic-needs', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateNeed(id: string, patch: Partial<AcademicNeed>): Promise<AcademicNeed> {
    return apiFetch<AcademicNeed>(`/api/academic-needs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  async deleteNeed(id: string): Promise<{ ok: boolean }> {
    await apiFetch(`/api/academic-needs/${id}`, {
      method: 'DELETE',
    });
    return { ok: true };
  },

  async listFines(): Promise<FineEntry[]> {
    const res = await apiFetch<any>('/api/fines');
    return (res.fineHistory || []).map((f: any) => ({
      id: f.id,
      userId: f.userId,
      amount: f.amount,
      reason: f.reason,
      at: f.createdAt,
    }));
  },

  async listNotifications(): Promise<NotificationItem[]> {
    const res = await apiFetch<any[]>('/api/notifications');
    return res.map((n) => ({
      id: n.id,
      userId: n.userId,
      title: n.title,
      body: n.message || n.body || '',
      read: n.read,
      at: n.createdAt,
    }));
  },

  async markNotificationRead(id: string): Promise<void> {
    await apiFetch(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },
};
