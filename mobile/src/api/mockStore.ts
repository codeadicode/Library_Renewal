import { addDays, formatISO } from 'date-fns';
import { httpClient } from './httpClient';

import {
  academicNeeds as seedNeeds,
  activities as seedActivities,
  books,
  copies as seedCopies,
  courses,
  fines as seedFines,
  loans as seedLoans,
  notifications as seedNotifications,
  policy,
  reservations as seedReservations,
  students as seedStudents,
  topics,
} from '../data/seed';
import { daysRemaining } from '../domain/loanDisplay';
import {
  AcademicNeed,
  ActivityItem,
  AlternativeMatch,
  AssessmentType,
  Book,
  BookCopy,
  BookFilter,
  EligibilityResult,
  FineEntry,
  Loan,
  NeedDecision,
  NotificationItem,
  NotificationPreference,
  NOW,
  ProfilePatch,
  RegisterInput,
  RenewalAttempt,
  Reservation,
  Student,
} from '../domain/types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const students: Student[] = clone(seedStudents);
const copies: BookCopy[] = clone(seedCopies);
const loans: Loan[] = clone(seedLoans);
const reservations: Reservation[] = clone(seedReservations);
const needs: AcademicNeed[] = clone(seedNeeds);
const fines: FineEntry[] = clone(seedFines);
const activities: ActivityItem[] = clone(seedActivities);
const notifications: NotificationItem[] = clone(seedNotifications);
const renewalAttempts: RenewalAttempt[] = [
  {
    id: 'ra-akash-cn',
    loanId: 'l-akash-cn',
    at: '2026-11-12T09:30:00+05:30',
    eligible: true,
    reasonCode: 'RENEWAL_SUCCESS',
    reason: 'Renewal recorded in the simulated catalogue.',
    newDueAt: '2026-12-09T21:00:00+05:30',
  },
];

let idCounter = 1000;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function publicStudent(student: Student): Omit<Student, 'password'> {
  const { password: _password, ...rest } = student;
  return rest;
}

export function topicName(id: string): string {
  return topics.find((t) => t.id === id)?.name ?? id;
}

export function courseName(id: string): string {
  const course = courses.find((c) => c.id === id);
  return course ? `${course.code} ${course.name}` : id;
}

export function availablePhysicalCount(bookId: string): number {
  return copies.filter((c) => c.bookId === bookId && c.status === 'AVAILABLE').length;
}

export function getBook(id: string): Book | undefined {
  return books.find((b) => b.id === id);
}

export function evaluateEligibility(loan: Loan, student: { id: string; restricted: boolean }): EligibilityResult {
  const book = getBook(loan.bookId);
  const days = daysRemaining(loan.dueAt);
  const hasReservation = reservations.some((r) => r.bookId === loan.bookId && r.status === 'ACTIVE' && r.userId !== student.id);

  if (days < 0) {
    return {
      eligible: false,
      reasonCode: 'LOAN_OVERDUE',
      reason: 'Overdue loans cannot be renewed until the item is returned and any simulated fine is cleared.',
      suggestedAction: 'RETURN',
      policyName: policy.name,
    };
  }
  if (student.restricted) {
    return {
      eligible: false,
      reasonCode: 'ACCOUNT_RESTRICTED',
      reason: 'This demo account is marked restricted, so renewals are blocked.',
      suggestedAction: 'FIND_ALTERNATIVE',
      policyName: policy.name,
    };
  }
  if (!book?.renewable) {
    return {
      eligible: false,
      reasonCode: 'ITEM_NOT_RENEWABLE',
      reason: 'This title is marked not renewable in the configured demo policy.',
      suggestedAction: 'FIND_ALTERNATIVE',
      policyName: policy.name,
    };
  }
  if (hasReservation) {
    return {
      eligible: false,
      reasonCode: 'ACTIVE_RESERVATION',
      reason: 'Another student has reserved this book.',
      suggestedAction: 'FIND_ALTERNATIVE',
      policyName: policy.name,
    };
  }
  if (loan.renewalCount >= policy.maxRenewals) {
    return {
      eligible: false,
      reasonCode: 'MAX_RENEWALS_REACHED',
      reason: `Maximum renewals (${policy.maxRenewals}) already used on this loan.`,
      suggestedAction: 'FIND_ALTERNATIVE',
      policyName: policy.name,
    };
  }
  return {
    eligible: true,
    reasonCode: 'ELIGIBLE',
    reason: `Eligible under ${policy.name}. A renewal would add ${policy.renewalPeriodDays} days.`,
    suggestedAction: 'RENEW',
    policyName: policy.name,
  };
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function rankAlternatives(sourceBookId: string, userId: string): AlternativeMatch[] {
  const source = getBook(sourceBookId);
  if (!source) return [];
  const userNeedTopics = needs
    .filter((n) => n.userId === userId)
    .map((n) => n.topic.toLowerCase());

  return books
    .filter((book) => book.id !== sourceBookId)
    .map((book) => {
      const topicScore = jaccard(source.topicIds, book.topicIds);
      const courseScore = jaccard(source.courseIds, book.courseIds);
      const levelScore = book.academicLevel === source.academicLevel ? 1 : 0.4;
      const needBoost = book.topicIds.some((id) => userNeedTopics.includes(topicName(id).toLowerCase()))
        ? 0.15
        : 0;
      const metadata = Math.min(1, topicScore * 0.75 + needBoost);
      const score =
        policy.recommendationWeights.metadata * metadata +
        policy.recommendationWeights.tfidf * topicScore +
        policy.recommendationWeights.course * courseScore +
        policy.recommendationWeights.level * levelScore;

      const matchingTopics = book.topicIds.filter((id) => source.topicIds.includes(id)).map(topicName);
      const reasons: string[] = matchingTopics.map((name) => `Covers ${name}.`);
      source.courseIds
        .filter((id) => book.courseIds.includes(id))
        .forEach((id) => reasons.push(`Relevant to ${courseName(id)}.`));
      if (book.academicLevel === source.academicLevel) {
        reasons.push(`Same academic level (${book.academicLevel}).`);
      }
      const availablePhysical = availablePhysicalCount(book.id);
      const digitalAccessible = Boolean(book.digitalUrl);
      if (availablePhysical > 0) {
        reasons.push(
          `${availablePhysical} physical cop${availablePhysical === 1 ? 'y is' : 'ies are'} available (simulated).`,
        );
      } else if (digitalAccessible) {
        reasons.push('No physical copy is free; a demo digital record exists.');
      } else {
        reasons.push('No currently accessible copy. Shown only if you still want related titles.');
      }

      return {
        bookId: book.id,
        score,
        matchingTopics,
        reasons,
        availablePhysical,
        digitalAccessible,
      };
    })
    .filter((row) => row.score >= 0.12)
    .sort((a, b) => {
      const accessA = a.availablePhysical > 0 || a.digitalAccessible ? 1 : 0;
      const accessB = b.availablePhysical > 0 || b.digitalAccessible ? 1 : 0;
      if (accessA !== accessB) return accessB - accessA;
      return b.score - a.score;
    })
    .slice(0, 8);
}

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(clone(value)), 180));
}

export const mockApi = {
  async login(identifier: string, password: string) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.login(identifier, password);
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    const key = identifier.trim().toLowerCase();
    const student = students.find(
      (s) => s.studentId.toLowerCase() === key || s.email.toLowerCase() === key,
    );
    // Demo mode: any password works for a known Student ID / email.
    if (!student) {
      return Promise.reject(new Error('No student found with that Student ID or email.'));
    }
    return delay(publicStudent(student));
  },

  async updateProfile(userId: string, patch: ProfilePatch) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.updateProfile(patch);
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    const student = students.find((s) => s.id === userId);
    if (!student) return Promise.reject(new Error('Session expired.'));
    const clean: ProfilePatch = {};
    (Object.keys(patch) as (keyof ProfilePatch)[]).forEach((k) => {
      const v = patch[k]?.trim();
      if (v) clean[k] = v;
    });
    if (clean.name !== undefined && clean.name.length < 2) {
      return Promise.reject(new Error('Name must be at least 2 characters.'));
    }
    if (clean.email !== undefined) {
      if (!/^\S+@\S+\.\S+$/.test(clean.email)) {
        return Promise.reject(new Error('Enter a valid email address.'));
      }
      const taken = students.some(
        (s) => s.id !== userId && s.email.toLowerCase() === clean.email!.toLowerCase(),
      );
      if (taken) return Promise.reject(new Error('That email is already used by another student.'));
    }
    Object.assign(student, clean);
    return delay(publicStudent(student));
  },

  /** Simulated return: closes the loan, frees the copy and records any overdue fine. */
  async returnLoan(userId: string, loanId: string) {
    const loan = loans.find((l) => l.id === loanId && l.userId === userId);
    if (!loan) return Promise.reject(new Error('Loan not found.'));
    if (loan.status === 'RETURNED') return delay(loan);
    const overdueDays = Math.max(0, -daysRemaining(loan.dueAt));
    loan.status = 'RETURNED';
    loan.returnedAt = formatISO(NOW);
    loan.markedForReturn = false;
    const copy = copies.find((c) => c.id === loan.copyId);
    if (copy) copy.status = 'AVAILABLE';
    const book = getBook(loan.bookId);
    if (overdueDays > 0 && !fines.some((f) => f.loanId === loan.id)) {
      fines.push({
        id: nextId('f'),
        userId,
        loanId: loan.id,
        amount: overdueDays * policy.finePerDay,
        reason: `Overdue loan: ${book?.title ?? 'book'} (${overdueDays} days × ₹${policy.finePerDay}/day)`,
        at: formatISO(NOW),
        simulated: true,
      });
    }
    activities.unshift({
      id: nextId('a'),
      userId,
      at: formatISO(NOW),
      kind: 'RETURNED',
      title: 'Book returned',
      detail: `${book?.title ?? 'Book'} was returned (simulated).`,
    });
    return delay(loan);
  },

  /** Simulated issue: takes a free physical copy and creates a loan for the standard period. */
  async borrowBook(userId: string, bookId: string) {
    const student = students.find((s) => s.id === userId);
    if (!student) return Promise.reject(new Error('Session expired.'));
    if (student.restricted) {
      return Promise.reject(new Error('This demo account is restricted and cannot borrow books.'));
    }
    if (loans.some((l) => l.userId === userId && l.bookId === bookId && l.status === 'ACTIVE')) {
      return Promise.reject(new Error('You already have this book issued.'));
    }
    const copy = copies.find((c) => c.bookId === bookId && c.status === 'AVAILABLE');
    if (!copy) return Promise.reject(new Error('No physical copy is free right now. Try reserving it.'));
    copy.status = 'ON_LOAN';
    const loan: Loan = {
      id: nextId('l'),
      userId,
      copyId: copy.id,
      bookId,
      issuedAt: formatISO(NOW),
      dueAt: formatISO(addDays(NOW, policy.loanPeriodDays)),
      status: 'ACTIVE',
      renewalCount: 0,
      markedForReturn: false,
    };
    loans.push(loan);
    activities.unshift({
      id: nextId('a'),
      userId,
      at: loan.issuedAt,
      kind: 'RESERVATION_UPDATE',
      title: 'Book issued',
      detail: `${getBook(bookId)?.title ?? 'Book'} issued until ${loan.dueAt.slice(0, 10)} (simulated).`,
    });
    return delay(loan);
  },

  async register(input: RegisterInput) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.register(input);
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    if (students.some((s) => s.studentId === input.studentId || s.email === input.email)) {
      return Promise.reject(new Error('Student ID or email is already registered in this demo.'));
    }
    const student: Student = {
      id: nextId('u'),
      studentId: input.studentId,
      name: input.name,
      email: input.email,
      password: input.password,
      course: input.course,
      academicYear: input.academicYear,
      restricted: false,
      notificationPreference: 'NORMAL',
    };
    students.push(student);
    return delay(publicStudent(student));
  },

  async me(userId: string) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.me();
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    const student = students.find((s) => s.id === userId);
    if (!student) return Promise.reject(new Error('Session expired.'));
    return delay(publicStudent(student));
  },

  async updatePreferences(userId: string, notificationPreference: NotificationPreference) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.updatePreferences(notificationPreference);
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    const student = students.find((s) => s.id === userId);
    if (!student) return Promise.reject(new Error('Not found'));
    student.notificationPreference = notificationPreference;
    return delay(publicStudent(student));
  },

  async listLoans(userId: string) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.listLoans();
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    return delay(loans.filter((l) => l.userId === userId));
  },

  async getLoan(userId: string, loanId: string) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.getLoan(loanId);
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    const loan = loans.find((l) => l.id === loanId && l.userId === userId);
    if (!loan) return Promise.reject(new Error('Loan not found.'));
    return delay(loan);
  },

  async eligibility(userId: string, loanId: string) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.checkEligibility(loanId);
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    const student = students.find((s) => s.id === userId);
    const loan = loans.find((l) => l.id === loanId && l.userId === userId);
    if (!student || !loan) return Promise.reject(new Error('Loan not found.'));
    return delay(evaluateEligibility(loan, student));
  },

  async renewalHistory(userId: string, loanId: string) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.renewalHistory(loanId);
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    const loan = loans.find((l) => l.id === loanId && l.userId === userId);
    if (!loan) return Promise.reject(new Error('Loan not found.'));
    return delay(renewalAttempts.filter((a) => a.loanId === loanId));
  },

  async renew(userId: string, loanId: string) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.renew(loanId);
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    const student = students.find((s) => s.id === userId);
    const loan = loans.find((l) => l.id === loanId && l.userId === userId);
    if (!student || !loan) throw new Error('Loan not found.');
    const result = evaluateEligibility(loan, student);
    const attempt: RenewalAttempt = {
      id: nextId('ra'),
      loanId,
      at: formatISO(NOW),
      eligible: result.eligible,
      reasonCode: result.eligible ? 'RENEWAL_SUCCESS' : result.reasonCode,
      reason: result.reason,
    };
    if (!result.eligible) {
      renewalAttempts.unshift(attempt);
      activities.unshift({
        id: nextId('a'),
        userId,
        at: attempt.at,
        kind: 'RENEWAL_FAILED',
        title: 'Failed renewal',
        detail: result.reason,
      });
      await delay(null);
      return { ok: false as const, result, attempt, loan };
    }
    loan.renewalCount += 1;
    loan.dueAt = formatISO(addDays(NOW, policy.renewalPeriodDays));
    attempt.newDueAt = loan.dueAt;
    renewalAttempts.unshift(attempt);
    activities.unshift({
      id: nextId('a'),
      userId,
      at: attempt.at,
      kind: 'RENEWAL_SUCCESS',
      title: 'Successful renewal',
      detail: `Simulated renewal. New due date ${loan.dueAt.slice(0, 10)}.`,
    });
    await delay(null);
    return { ok: true as const, result, attempt, loan: clone(loan) };
  },

  async decide(userId: string, loanId: string, decision: NeedDecision) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.decide(loanId, decision);
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    const loan = loans.find((l) => l.id === loanId && l.userId === userId);
    if (!loan) throw new Error('Loan not found.');
    loan.needDecision = decision;
    loan.markedForReturn = decision === 'DONE';
    loan.followUpAt = decision === 'NOT_SURE' ? formatISO(addDays(NOW, 2)) : undefined;
    activities.unshift({
      id: nextId('a'),
      userId,
      at: formatISO(NOW),
      kind: 'DECISION',
      title: 'Need decision saved',
      detail:
        decision === 'STILL_NEED'
          ? 'You still need this book. Check renewal next.'
          : decision === 'DONE'
            ? 'Marked for return. Renewal reminders are suppressed in this demo session.'
            : 'Deferred. One follow-up is scheduled for 23 Nov 2026.',
    });
    return delay(clone(loan));
  },

  async alternatives(userId: string, bookId: string) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.alternatives(bookId);
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    return delay(rankAlternatives(bookId, userId));
  },

  async reserve(userId: string, bookId: string) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.reserve(bookId);
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    const existing = reservations.find((r) => r.bookId === bookId && r.userId === userId && r.status === 'ACTIVE');
    if (existing) return delay(existing);
    const row: Reservation = { id: nextId('r'), bookId, userId, status: 'ACTIVE' };
    reservations.push(row);
    activities.unshift({
      id: nextId('a'),
      userId,
      at: formatISO(NOW),
      kind: 'RESERVATION_UPDATE',
      title: 'Reservation placed',
      detail: 'Simulated hold placed on this title.',
    });
    return delay(row);
  },

  async listNeeds(userId: string) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.listNeeds();
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    return delay(needs.filter((n) => n.userId === userId));
  },

  async addNeed(userId: string, input: Omit<AcademicNeed, 'id' | 'userId'>) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.addNeed(input);
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    const row: AcademicNeed = { ...input, id: nextId('n'), userId };
    needs.push(row);
    return delay(row);
  },

  async updateNeed(userId: string, id: string, patch: Partial<AcademicNeed>) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.updateNeed(id, patch);
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    const row = needs.find((n) => n.id === id && n.userId === userId);
    if (!row) return Promise.reject(new Error('Need not found.'));
    Object.assign(row, patch);
    return delay(clone(row));
  },

  async deleteNeed(userId: string, id: string) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.deleteNeed(id);
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    const index = needs.findIndex((n) => n.id === id && n.userId === userId);
    if (index >= 0) needs.splice(index, 1);
    return delay({ ok: true });
  },

  async listFines(userId: string) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.listFines();
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    return delay(fines.filter((f) => f.userId === userId));
  },

  async listNotifications(userId: string) {
    if (httpClient.isConfigured()) {
      try {
        return await httpClient.listNotifications();
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    return delay(notifications.filter((n) => n.userId === userId));
  },

  async markNotificationRead(userId: string, id: string) {
    if (httpClient.isConfigured()) {
      try {
        await httpClient.markNotificationRead(id);
        const row = notifications.find((n) => n.id === id && n.userId === userId);
        if (row) row.read = true;
        return delay(row);
      } catch (err: any) {
        if (err.status) throw err;
      }
    }
    const row = notifications.find((n) => n.id === id && n.userId === userId);
    if (row) row.read = true;
    return delay(row);
  },

  listBooks(query?: { q?: string; available?: boolean; type?: string; category?: string; courseId?: string }) {
    const q = query?.q?.trim().toLowerCase() ?? '';
    let list = books.filter((book) => {
      if (!q) return true;
      const topicText = book.topicIds.map(topicName).join(' ').toLowerCase();
      return (
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.isbn.includes(q) ||
        book.category.toLowerCase().includes(q) ||
        topicText.includes(q)
      );
    });
    if (query?.category) list = list.filter((b) => b.category === query.category);
    if (query?.courseId) list = list.filter((b) => b.courseIds.includes(query.courseId!));
    if (query?.type === 'PHYSICAL') list = list.filter((b) => b.resourceType !== 'DIGITAL');
    if (query?.type === 'DIGITAL') list = list.filter((b) => b.resourceType !== 'PHYSICAL');
    if (query?.available === true) {
      list = list.filter((b) => availablePhysicalCount(b.id) > 0 || Boolean(b.digitalUrl));
    }
    if (query?.available === false) {
      list = list.filter((b) => availablePhysicalCount(b.id) === 0 && !b.digitalUrl);
    }
    return delay(list);
  },

  getBookDetail(id: string) {
    const book = getBook(id);
    if (!book) return Promise.reject(new Error('Book not found.'));
    return delay({
      book,
      copies: copies.filter((c) => c.bookId === id),
      availablePhysical: availablePhysicalCount(id),
      topics: book.topicIds.map(topicName),
      courses: book.courseIds.map(courseName),
    });
  },

  listActivity(userId: string) {
    return delay(activities.filter((a) => a.userId === userId).slice(0, 12));
  },

  estimateFine(loan: Loan): number {
    const days = daysRemaining(loan.dueAt);
    if (days >= 0) return 0;
    return Math.abs(days) * policy.finePerDay;
  },

  loanMatchesFilter(loan: Loan, filter: BookFilter): boolean {
    const days = daysRemaining(loan.dueAt);
    switch (filter) {
      case 'ISSUED':
        return loan.status === 'ACTIVE';
      case 'DUE_SOON':
        return loan.status === 'ACTIVE' && days >= 0 && days <= policy.approachingMaxDays;
      case 'OVERDUE':
        return loan.status === 'ACTIVE' && days < 0;
      case 'RETURNED':
        return loan.status === 'RETURNED';
      default:
        return true;
    }
  },

  filterLoans(userLoans: Loan[], filter: BookFilter, q: string): Loan[] {
    const query = q.trim().toLowerCase();
    return userLoans
      .filter((loan) => mockApi.loanMatchesFilter(loan, filter))
      .filter((loan) => {
        if (!query) return true;
        const book = getBook(loan.bookId);
        const hay = `${book?.title} ${book?.author} ${book?.category}`.toLowerCase();
        return hay.includes(query);
      })
      .sort((a, b) =>
        filter === 'RETURNED'
          ? (b.returnedAt ?? '').localeCompare(a.returnedAt ?? '')
          : a.dueAt.localeCompare(b.dueAt),
      );
  },

  policy,
  books,
  topics,
  courses,
};

export type PublicStudent = Omit<Student, 'password'>;
export type Assessment = AssessmentType;
