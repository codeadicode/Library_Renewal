/**
 * Offline mock implementation of LibraryApi, used only when
 * EXPO_PUBLIC_API_URL is not set. It is never used as a fallback in API mode.
 * Rules mirror the backend (returned loans cannot be renewed, ledger fines are
 * separate from estimates, money is computed in paise).
 */
import { addDays, differenceInCalendarDays, formatISO, parseISO, startOfDay } from 'date-fns';

import { now } from '../config';
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
import { daysRemaining, isOpenLoan } from '../domain/loanDisplay';
import {
  AcademicContext,
  AcademicNeed,
  ActionCentre,
  ActivityItem,
  AlternativeMatch,
  Book,
  BookCopy,
  EligibilityResult,
  FineEntry,
  Loan,
  NotificationItem,
  RenewalAttempt,
  Reservation,
  Student,
} from '../domain/types';
import type { LibraryApi, PublicStudent } from './types';

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
const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

const toPaise = (n: number) => Math.round(n * 100);
const fromPaise = (n: number) => n / 100;
const sumMoney = (xs: number[]) => fromPaise(xs.reduce((s, x) => s + toPaise(x), 0));

function publicStudent(student: Student): PublicStudent {
  const { password: _password, ...rest } = student;
  return rest;
}

const topicName = (id: string) => topics.find((t) => t.id === id)?.name ?? id;
const courseName = (id: string) => {
  const course = courses.find((c) => c.id === id);
  return course ? `${course.code} ${course.name}` : id;
};
const getBook = (id: string): Book | undefined => books.find((b) => b.id === id);
const availablePhysicalCount = (bookId: string) =>
  copies.filter((c) => c.bookId === bookId && c.status === 'AVAILABLE').length;
const availableCounts = () => Object.fromEntries(books.map((b) => [b.id, availablePhysicalCount(b.id)]));

/** Mock loans are stored ACTIVE/RETURNED; OVERDUE is derived like on the server. */
function withStatus(loan: Loan): Loan {
  if (loan.status === 'RETURNED') return clone(loan);
  return { ...clone(loan), status: daysRemaining(loan.dueAt) < 0 ? 'OVERDUE' : 'ACTIVE' };
}

function academicContextFor(loan: Loan, projectedDueAt?: string): AcademicContext | null {
  const book = getBook(loan.bookId);
  if (!book || loan.status === 'RETURNED') return null;
  const at = startOfDay(now());
  const bookTopics = book.topicIds.map((id) => topicName(id).toLowerCase());
  const match = needs
    .filter((n) => n.userId === loan.userId && startOfDay(parseISO(n.neededUntil)) >= at)
    .filter((n) => bookTopics.some((t) => t.includes(n.topic.toLowerCase()) || n.topic.toLowerCase().includes(t)))
    .sort((a, b) => b.neededUntil.localeCompare(a.neededUntil))[0];
  if (!match) return null;
  const until = startOfDay(parseISO(match.neededUntil));
  return {
    needId: match.id,
    course: match.course,
    topic: match.topic,
    assessmentType: match.assessmentType,
    assessmentDate: match.assessmentDate,
    neededUntil: match.neededUntil,
    daysUntilAssessment: differenceInCalendarDays(parseISO(match.assessmentDate), now()),
    neededBeyondDue: until > startOfDay(parseISO(loan.dueAt)),
    ...(projectedDueAt ? { renewalCoversNeed: startOfDay(parseISO(projectedDueAt)) >= until } : {}),
  };
}

function evaluateEligibility(loan: Loan, student: { id: string; restricted: boolean }): EligibilityResult {
  const book = getBook(loan.bookId);
  const days = daysRemaining(loan.dueAt);
  const base = { policyName: policy.name, maxRenewals: policy.maxRenewals, renewalsUsed: loan.renewalCount };
  const blocked = (reasonCode: EligibilityResult['reasonCode'], reason: string, suggestedAction: EligibilityResult['suggestedAction']) => ({
    ...base,
    eligible: false,
    reasonCode,
    reason,
    suggestedAction,
    academicContext: academicContextFor(loan),
  });

  if (loan.status === 'RETURNED') {
    return blocked('LOAN_RETURNED', 'This loan has already been returned, so it cannot be renewed.', 'NONE');
  }
  if (days < 0) {
    return blocked('LOAN_OVERDUE', 'Overdue loans cannot be renewed until the item is returned.', 'RETURN');
  }
  if (student.restricted) {
    return blocked('ACCOUNT_RESTRICTED', 'This demo account is marked restricted, so renewals are blocked.', 'FIND_ALTERNATIVE');
  }
  if (!book?.renewable) {
    return blocked('ITEM_NOT_RENEWABLE', 'This title is marked not renewable in the configured demo policy.', 'FIND_ALTERNATIVE');
  }
  if (reservations.some((r) => r.bookId === loan.bookId && r.status === 'ACTIVE' && r.userId !== student.id)) {
    return blocked('ACTIVE_RESERVATION', 'Another student has reserved this book.', 'FIND_ALTERNATIVE');
  }
  if (loan.renewalCount >= policy.maxRenewals) {
    return blocked('MAX_RENEWALS_REACHED', `Maximum renewals (${policy.maxRenewals}) already used on this loan.`, 'FIND_ALTERNATIVE');
  }
  const projectedDueAt = formatISO(addDays(parseISO(loan.dueAt), policy.renewalPeriodDays));
  return {
    ...base,
    eligible: true,
    reasonCode: 'ELIGIBLE',
    reason: `Eligible under ${policy.name}. A renewal would add ${policy.renewalPeriodDays} days.`,
    suggestedAction: 'RENEW',
    projectedDueAt,
    academicContext: academicContextFor(loan, projectedDueAt),
  };
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function rankAlternatives(sourceBookId: string, userId: string): AlternativeMatch[] {
  const source = getBook(sourceBookId);
  if (!source) return [];
  const at = startOfDay(now());
  const activeNeeds = needs.filter((n) => n.userId === userId && startOfDay(parseISO(n.neededUntil)) >= at);

  return books
    .filter((book) => book.id !== sourceBookId)
    .map((book) => {
      const topicScore = jaccard(source.topicIds, book.topicIds);
      const courseScore = jaccard(source.courseIds, book.courseIds);
      const levelScore = book.academicLevel === source.academicLevel ? 1 : 0.4;
      const need = activeNeeds.find((n) => book.topicIds.some((id) => topicName(id).toLowerCase() === n.topic.toLowerCase()));
      const needDays = need ? differenceInCalendarDays(parseISO(need.assessmentDate), now()) : Infinity;
      const needWeight = !need ? 0 : needDays <= 7 ? 1 : needDays <= 21 ? 0.7 : 0.4;
      const metadata = Math.min(1, topicScore * 0.8 + 0.2 * needWeight);
      const w = policy.recommendationWeights;
      const score = w.metadata * metadata + w.tfidf * topicScore + w.course * courseScore + w.level * levelScore;

      const matchingTopics = book.topicIds.filter((id) => source.topicIds.includes(id)).map(topicName);
      const reasons: string[] = matchingTopics.map((name) => `Covers ${name}.`);
      source.courseIds.filter((id) => book.courseIds.includes(id)).forEach((id) => reasons.push(`Relevant to ${courseName(id)}.`));
      if (book.academicLevel === source.academicLevel) reasons.push(`Same academic level (${book.academicLevel}).`);
      if (need) reasons.push(`Covers ${need.topic} for your ${need.assessmentType.toLowerCase()} (in ${needDays} days).`);

      const availablePhysical = availablePhysicalCount(book.id);
      const digitalAccessible = Boolean(book.digitalUrl);
      if (availablePhysical > 0) {
        reasons.push(`${availablePhysical} physical cop${availablePhysical === 1 ? 'y is' : 'ies are'} available (simulated).`);
      } else if (digitalAccessible) {
        reasons.push('No physical copy is free; a demo digital record exists.');
      } else {
        reasons.push('No currently accessible copy. Shown only if you still want related titles.');
      }
      return { bookId: book.id, book, score, matchingTopics, reasons, availablePhysical, digitalAccessible };
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
  return new Promise((resolve) => setTimeout(() => resolve(clone(value)), 120));
}

function findStudent(userId: string): Student {
  const student = students.find((s) => s.id === userId);
  if (!student) throw new Error('Session expired.');
  return student;
}

function findLoan(userId: string, loanId: string): Loan {
  const loan = loans.find((l) => l.id === loanId && l.userId === userId);
  if (!loan) throw new Error('Loan not found.');
  return loan;
}

function addActivity(userId: string, kind: ActivityItem['kind'], title: string, detail: string) {
  activities.unshift({ id: nextId('a'), userId, at: formatISO(now()), kind, title, detail });
}

export const mockApi: LibraryApi = {
  mode: 'mock',

  async login(identifier, password) {
    const key = identifier.trim().toLowerCase();
    const student = students.find((s) => s.studentId.toLowerCase() === key || s.email.toLowerCase() === key);
    if (!student || student.password !== password) {
      throw new Error('Invalid Student ID / email or password.');
    }
    return delay({ user: publicStudent(student) });
  },

  async register(input) {
    if (input.password.length < 8) throw new Error('Password must be at least 8 characters.');
    const email = input.email.trim().toLowerCase();
    if (students.some((s) => s.studentId === input.studentId || s.email === email)) {
      throw new Error('Student ID or email is already registered in this demo.');
    }
    const student: Student = {
      ...input,
      email,
      id: nextId('u'),
      restricted: false,
      notificationPreference: 'NORMAL',
    };
    students.push(student);
    return delay({ user: publicStudent(student) });
  },

  async me(userId) {
    return delay(publicStudent(findStudent(userId)));
  },

  async updatePreferences(userId, pref) {
    const student = findStudent(userId);
    student.notificationPreference = pref;
    return delay(publicStudent(student));
  },

  async updateProfile(userId, patch) {
    const student = findStudent(userId);
    const clean: typeof patch = {};
    (Object.keys(patch) as (keyof typeof patch)[]).forEach((k) => {
      const v = patch[k]?.trim();
      if (v) clean[k] = v;
    });
    if (clean.name !== undefined && clean.name.length < 2) throw new Error('Name must be at least 2 characters.');
    if (clean.email !== undefined) {
      if (!/^\S+@\S+\.\S+$/.test(clean.email)) throw new Error('Enter a valid email address.');
      clean.email = clean.email.toLowerCase();
      if (students.some((s) => s.id !== userId && s.email.toLowerCase() === clean.email)) {
        throw new Error('That email is already used by another student.');
      }
    }
    Object.assign(student, clean);
    return delay(publicStudent(student));
  },

  getPolicy: () => delay(policy),

  getCatalogue: () => delay({ books, availableCounts: availableCounts(), topics, courses }),

  async listBooks(query) {
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
    if (query?.available === true) list = list.filter((b) => availablePhysicalCount(b.id) > 0 || Boolean(b.digitalUrl));
    if (query?.available === false) list = list.filter((b) => availablePhysicalCount(b.id) === 0 && !b.digitalUrl);
    return delay({ books: list, availableCounts: availableCounts() });
  },

  async getBookDetail(id) {
    const book = getBook(id);
    if (!book) throw new Error('Book not found.');
    return delay({
      book,
      copies: copies.filter((c) => c.bookId === id),
      availablePhysical: availablePhysicalCount(id),
      topics: book.topicIds.map(topicName),
      courses: book.courseIds.map(courseName),
    });
  },

  async listLoans(userId) {
    return delay(loans.filter((l) => l.userId === userId).map(withStatus));
  },

  async getLoan(userId, loanId) {
    return delay(withStatus(findLoan(userId, loanId)));
  },

  async eligibility(userId, loanId) {
    return delay(evaluateEligibility(withStatus(findLoan(userId, loanId)), findStudent(userId)));
  },

  async actionCentre(userId): Promise<ActionCentre> {
    const student = findStudent(userId);
    const open = loans.filter((l) => l.userId === userId).map(withStatus).filter(isOpenLoan);
    const eligibilityByLoan: ActionCentre['eligibilityByLoan'] = {};
    const needsAttention: ActionCentre['needsAttention'] = [];
    for (const loan of open) {
      const eligibility = evaluateEligibility(loan, student);
      eligibilityByLoan[loan.id] = eligibility;
      const days = daysRemaining(loan.dueAt);
      const ctx = eligibility.academicContext ?? null;
      const pressure = !!ctx?.neededBeyondDue && ctx.daysUntilAssessment <= policy.approachingMaxDays * 2;
      if (!(days <= policy.approachingMaxDays || loan.markedForReturn || pressure)) continue;
      const actionLabel = loan.markedForReturn
        ? 'Prepare return'
        : days < 0
          ? 'Return book'
          : eligibility.eligible
            ? ctx?.neededBeyondDue
              ? 'Renew now'
              : 'Check renewal'
            : eligibility.suggestedAction === 'FIND_ALTERNATIVE'
              ? 'Find alternatives'
              : 'Review';
      needsAttention.push({
        loanId: loan.id,
        bookId: loan.bookId,
        daysRemaining: days,
        actionLabel,
        why: eligibility.eligible ? `Due in ${days} day(s).` : eligibility.reason,
        eligibility,
        academicContext: ctx,
      });
    }
    needsAttention.sort((a, b) => a.daysRemaining - b.daysRemaining);
    return delay({ needsAttention, eligibilityByLoan });
  },

  async renewalHistory(userId, loanId) {
    findLoan(userId, loanId);
    return delay(renewalAttempts.filter((a) => a.loanId === loanId));
  },

  async renew(userId, loanId) {
    const student = findStudent(userId);
    const loan = findLoan(userId, loanId);
    const result = evaluateEligibility(withStatus(loan), student);
    const attempt: RenewalAttempt = {
      id: nextId('ra'),
      loanId,
      at: formatISO(now()),
      eligible: result.eligible,
      reasonCode: result.eligible ? 'RENEWAL_SUCCESS' : result.reasonCode,
      reason: result.reason,
    };
    if (!result.eligible) {
      renewalAttempts.unshift(attempt);
      addActivity(userId, 'RENEWAL_FAILED', 'Failed renewal', result.reason);
      return delay({ ok: false, result, loan: withStatus(loan) });
    }
    loan.renewalCount += 1;
    loan.dueAt = formatISO(addDays(parseISO(loan.dueAt), policy.renewalPeriodDays));
    attempt.newDueAt = loan.dueAt;
    renewalAttempts.unshift(attempt);
    addActivity(userId, 'RENEWAL_SUCCESS', 'Successful renewal', `New due date ${loan.dueAt.slice(0, 10)}.`);
    return delay({ ok: true, result, loan: withStatus(loan) });
  },

  async decide(userId, loanId, decision) {
    const loan = findLoan(userId, loanId);
    if (loan.status === 'RETURNED') throw new Error('This loan has already been returned.');
    loan.needDecision = decision;
    loan.markedForReturn = decision === 'DONE';
    let followUp = addDays(now(), 2);
    if (followUp > parseISO(loan.dueAt)) followUp = parseISO(loan.dueAt);
    loan.followUpAt = decision === 'NOT_SURE' ? formatISO(followUp) : undefined;
    addActivity(
      userId,
      'DECISION',
      'Need decision saved',
      decision === 'STILL_NEED'
        ? 'You still need this book. Check renewal next.'
        : decision === 'DONE'
          ? 'Marked for return. Due-soon reminders are switched off for it.'
          : `Deferred. One follow-up is scheduled for ${formatISO(followUp, { representation: 'date' })}.`,
    );
    return delay(withStatus(loan));
  },

  async returnLoan(userId, loanId) {
    const loan = findLoan(userId, loanId);
    if (loan.status === 'RETURNED') throw new Error('This loan has already been returned.');
    const overdueDays = Math.max(0, -daysRemaining(loan.dueAt));
    loan.status = 'RETURNED';
    loan.returnedAt = formatISO(now());
    loan.markedForReturn = false;
    loan.followUpAt = undefined;
    const copy = copies.find((c) => c.id === loan.copyId);
    if (copy) copy.status = reservations.some((r) => r.bookId === loan.bookId && r.status === 'ACTIVE' && r.userId !== userId) ? 'RESERVED' : 'AVAILABLE';
    const book = getBook(loan.bookId);
    let fine: FineEntry | null = null;
    if (overdueDays > 0 && !fines.some((f) => f.loanId === loan.id)) {
      fine = {
        id: nextId('f'),
        userId,
        loanId: loan.id,
        amount: fromPaise(toPaise(policy.finePerDay) * overdueDays),
        reason: `Returned late: ${book?.title ?? 'book'} (${overdueDays} days × ₹${policy.finePerDay.toFixed(2)}/day)`,
        at: formatISO(now()),
      };
      fines.push(fine);
    }
    addActivity(userId, 'RETURNED', 'Book returned', `${book?.title ?? 'Book'} was returned.`);
    return delay({ loan: withStatus(loan), fine });
  },

  async borrowBook(userId, bookId) {
    const student = findStudent(userId);
    if (student.restricted) throw new Error('This demo account is restricted and cannot borrow books.');
    if (loans.some((l) => l.userId === userId && l.bookId === bookId && l.status !== 'RETURNED')) {
      throw new Error('You already have this book issued.');
    }
    const copy = copies.find((c) => c.bookId === bookId && c.status === 'AVAILABLE');
    if (!copy) throw new Error('No physical copy is free right now. Try reserving it.');
    copy.status = 'ON_LOAN';
    const loan: Loan = {
      id: nextId('l'),
      userId,
      copyId: copy.id,
      bookId,
      issuedAt: formatISO(now()),
      dueAt: formatISO(addDays(now(), policy.loanPeriodDays)),
      status: 'ACTIVE',
      renewalCount: 0,
      markedForReturn: false,
    };
    loans.push(loan);
    addActivity(userId, 'RESERVATION_UPDATE', 'Book issued', `${getBook(bookId)?.title ?? 'Book'} issued until ${loan.dueAt.slice(0, 10)}.`);
    return delay(withStatus(loan));
  },

  async reserve(userId, bookId) {
    if (loans.some((l) => l.userId === userId && l.bookId === bookId && l.status !== 'RETURNED')) {
      throw new Error('You already have this book issued.');
    }
    const existing = reservations.find((r) => r.bookId === bookId && r.userId === userId && r.status === 'ACTIVE');
    if (existing) return delay(existing);
    const row: Reservation = { id: nextId('r'), bookId, userId, status: 'ACTIVE' };
    reservations.push(row);
    addActivity(userId, 'RESERVATION_UPDATE', 'Reservation placed', 'Simulated hold placed on this title.');
    return delay(row);
  },

  async alternatives(userId, bookId) {
    return delay(rankAlternatives(bookId, userId));
  },

  async listNeeds(userId) {
    return delay(needs.filter((n) => n.userId === userId));
  },

  async addNeed(userId, input) {
    if (input.neededUntil < input.assessmentDate) throw new Error('"Needed until" cannot be before the assessment date.');
    if (startOfDay(parseISO(input.neededUntil)) < startOfDay(now())) throw new Error('"Needed until" is already in the past.');
    const row: AcademicNeed = { ...input, id: nextId('n'), userId };
    needs.push(row);
    return delay(row);
  },

  async deleteNeed(userId, id) {
    const index = needs.findIndex((n) => n.id === id && n.userId === userId);
    if (index >= 0) needs.splice(index, 1);
    return delay({ ok: true });
  },

  async getFines(userId) {
    const entries = fines.filter((f) => f.userId === userId);
    const estimates = loans
      .filter((l) => l.userId === userId && l.status !== 'RETURNED' && daysRemaining(l.dueAt) < 0)
      .map((l) => {
        const daysOverdue = -daysRemaining(l.dueAt);
        return {
          loanId: l.id,
          bookId: l.bookId,
          bookTitle: getBook(l.bookId)?.title ?? 'Unknown title',
          daysOverdue,
          estimatedFine: fromPaise(toPaise(policy.finePerDay) * daysOverdue),
        };
      });
    return delay({
      dailyRate: policy.finePerDay,
      ledger: { total: sumMoney(entries.map((e) => e.amount)), entries },
      estimates: { total: sumMoney(estimates.map((e) => e.estimatedFine)), loans: estimates },
    });
  },

  async estimateFine(userId, loanId) {
    const loan = findLoan(userId, loanId);
    const recordedAmount = sumMoney(fines.filter((f) => f.loanId === loanId).map((f) => f.amount));
    if (loan.status === 'RETURNED') {
      return delay({
        daysLate: 0,
        estimatedAmount: 0,
        dailyRate: policy.finePerDay,
        returned: true,
        recordedAmount,
        calculation: recordedAmount > 0 ? `Returned. ₹${recordedAmount.toFixed(2)} is in the fine ledger.` : 'Returned on time.',
      });
    }
    const daysLate = Math.max(0, -daysRemaining(loan.dueAt));
    const estimatedAmount = fromPaise(toPaise(policy.finePerDay) * daysLate);
    return delay({
      daysLate,
      estimatedAmount,
      dailyRate: policy.finePerDay,
      returned: false,
      recordedAmount,
      calculation: `${daysLate} overdue days × ₹${policy.finePerDay.toFixed(2)}/day = ₹${estimatedAmount.toFixed(2)} (estimate)`,
    });
  },

  async listNotifications(userId) {
    return delay(notifications.filter((n) => n.userId === userId));
  },

  async markNotificationRead(userId, id) {
    const row = notifications.find((n) => n.id === id && n.userId === userId);
    if (row) row.read = true;
  },

  async listActivity(userId) {
    return delay(activities.filter((a) => a.userId === userId).slice(0, 12));
  },
};
