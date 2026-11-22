/**
 * Regression tests for the correctness fixes: returned-loan renewal, atomic and
 * concurrent renewal, fine ownership, derived loan status, money precision,
 * fine ledger vs estimates, notification preferences and persisted follow-ups,
 * academic-need timing, benchmark maths and JWT secret handling.
 */
import { addDays } from 'date-fns';
import { MemoryDataStore, MemoryStore } from '../repositories/memoryStore';
import { createServices, Services } from '../services';
import { setClockOverride } from '../lib/clock';
import { fromMinor, multiplyMoney, sumMoney, toMinor } from '../lib/money';
import { nextDigestTime, routeFor } from '../services/NotificationService';
import { buildAcademicContext, isActiveNeed, needUrgencyWeight } from '../services/academicPlanning';
import { BENCHMARK_QUERIES, compareMetrics, runRecommendationBenchmark, writeConclusion } from '../recommendation/benchmark';
import { HttpError } from '../lib/errors';

const ANCHOR = new Date('2026-11-21T06:30:00Z');

let store: MemoryStore;
let data: MemoryDataStore;
let svc: Services;

beforeEach(() => {
  setClockOverride(ANCHOR);
  store = new MemoryStore(ANCHOR);
  data = new MemoryDataStore(store);
  svc = createServices(data);
});

afterAll(() => setClockOverride(null));

const statusOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (err) {
    return err instanceof HttpError ? err.statusCode : 'error';
  }
};

describe('Renewal correctness', () => {
  test('a returned loan is never renewable, and the refusal is audited', async () => {
    const { eligibility } = await svc.renewals.evaluateEligibility('l-priya-opp-returned', 'u-priya');
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason_code).toBe('LOAN_RETURNED');

    const result = await svc.renewals.processRenewal('l-priya-opp-returned', 'u-priya');
    expect(result.success).toBe(false);
    expect(result.loan.renewalCount).toBe(0);
    expect(result.attempt.reasonCode).toBe('LOAN_RETURNED');
  });

  test('a loan returned through the API can no longer be renewed', async () => {
    await svc.loans.returnLoan('l-akash-dsc', 'u-akash');
    const result = await svc.renewals.processRenewal('l-akash-dsc', 'u-akash');
    expect(result.success).toBe(false);
    expect(result.eligibility.reason_code).toBe('LOAN_RETURNED');
  });

  test('concurrent renewals cannot exceed the renewal limit', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => svc.renewals.processRenewal('l-akash-dsc', 'u-akash')),
    );
    const successes = results.filter((r) => r.success);
    expect(successes).toHaveLength(2); // policy.maxRenewals
    const loan = await data.repos.loans.findById('l-akash-dsc');
    expect(loan!.renewalCount).toBe(2);
    expect(new Date(loan!.dueAt).getTime()).toBe(addDays(ANCHOR, 2 + 28).getTime()); // two 14-day renewals

    const history = await data.repos.renewalAttempts.findByLoanId('l-akash-dsc');
    expect(history).toHaveLength(6);
    expect(history.filter((a) => a.reasonCode === 'RENEWAL_SUCCESS')).toHaveLength(2);
    expect(history.filter((a) => a.reasonCode === 'MAX_RENEWALS_REACHED')).toHaveLength(4);
  });

  test('renewal and its audit row are atomic: a failed audit write rolls the renewal back', async () => {
    const original = data.repos.renewalAttempts.create.bind(data.repos.renewalAttempts);
    data.repos.renewalAttempts.create = async () => {
      throw new Error('audit store unavailable');
    };
    await expect(svc.renewals.processRenewal('l-akash-dsc', 'u-akash')).rejects.toThrow('audit store unavailable');

    const loan = await data.repos.loans.findById('l-akash-dsc');
    expect(loan!.renewalCount).toBe(0);
    expect(await data.repos.renewalAttempts.findByLoanId('l-akash-dsc')).toHaveLength(0);

    data.repos.renewalAttempts.create = original;
    expect((await svc.renewals.processRenewal('l-akash-dsc', 'u-akash')).success).toBe(true);
  });
});

describe('Loan status', () => {
  test('OVERDUE is derived from the due date and never stored', async () => {
    const priya = await data.repos.loans.findById('l-priya-sadiku');
    expect(priya!.status).toBe('OVERDUE');
    expect(store.loans.get('l-priya-sadiku')!.status).toBe('ACTIVE');

    // Move the clock past Aadya's due date (+3 days): the same row now reads as overdue.
    expect((await data.repos.loans.findById('l-aadya-os'))!.status).toBe('ACTIVE');
    setClockOverride(addDays(ANCHOR, 5));
    expect((await data.repos.loans.findById('l-aadya-os'))!.status).toBe('OVERDUE');
  });

  test('renewing never writes OVERDUE and the returned status is consistent', async () => {
    await data.repos.loans.update('l-aadya-os', { status: 'OVERDUE' });
    expect(store.loans.get('l-aadya-os')!.status).toBe('ACTIVE');
    const { loan } = await svc.loans.returnLoan('l-aadya-os', 'u-aadya');
    expect(loan.status).toBe('RETURNED');
    expect(loan.returnedAt).toBeTruthy();
  });
});

describe('Fines', () => {
  test('fine estimates are only available to the loan owner', async () => {
    expect(await statusOf(svc.fines.estimateLateFine('l-priya-sadiku', 'u-akash'))).toBe(403);
    const own = await svc.fines.estimateLateFine('l-priya-sadiku', 'u-priya');
    expect(own.daysLate).toBe(4);
    expect(own.estimatedAmount).toBe(20);
  });

  test('ledger amounts and estimates are reported separately and never double-counted', async () => {
    const before = await svc.fines.getUserFines('u-priya');
    expect(before.ledger.total).toBe(15); // returned-late loan
    expect(before.estimates.total).toBe(20); // open overdue loan, not owed yet
    expect(before.estimates.loans[0].loanId).toBe('l-priya-sadiku');

    const { fine } = await svc.loans.returnLoan('l-priya-sadiku', 'u-priya');
    expect(fine!.amount).toBe(20);

    const after = await svc.fines.getUserFines('u-priya');
    expect(after.ledger.total).toBe(35);
    expect(after.estimates.total).toBe(0);

    expect(await statusOf(svc.loans.returnLoan('l-priya-sadiku', 'u-priya'))).toBe(409);
    expect((await svc.fines.getUserFines('u-priya')).ledger.total).toBe(35);
  });

  test('money arithmetic is exact to the paisa', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(multiplyMoney(0.1, 3)).toBe(0.3);
    expect(multiplyMoney(5.55, 7)).toBe(38.85);
    expect(sumMoney(Array(10).fill(0.1))).toBe(1);
    expect(fromMinor(toMinor('12.345'))).toBe(12.35);
  });

  test('ledger totals stay exact with fractional rates', async () => {
    store.policy.finePerDay = 0.1;
    await data.repos.fines.create({ userId: 'u-akash', loanId: null, amount: 0.1, reason: 'a' });
    await data.repos.fines.create({ userId: 'u-akash', loanId: null, amount: 0.2, reason: 'b' });
    const summary = await svc.fines.getUserFines('u-akash');
    expect(summary.ledger.total).toBe(0.3);
  });
});

describe('Notification preferences', () => {
  test('routing table', () => {
    expect(routeFor('NORMAL', 'DECISION')).toBe('DELIVER');
    expect(routeFor('IMPORTANT', 'DECISION')).toBe('SUPPRESS');
    expect(routeFor('IMPORTANT', 'OVERDUE')).toBe('DELIVER');
    expect(routeFor('IMPORTANT', 'FOLLOW_UP')).toBe('DELIVER');
    expect(routeFor('DIGEST', 'DUE_SOON')).toBe('DIGEST');
    expect(routeFor('DIGEST', 'DUE_TODAY')).toBe('DELIVER');
    expect(routeFor('QUIET', 'FOLLOW_UP')).toBe('SUPPRESS');
    expect(routeFor('QUIET', 'OVERDUE')).toBe('DELIVER');
  });

  test('a QUIET student receives no decision confirmation', async () => {
    const before = (await data.repos.notifications.findByUserId('u-dev')).length;
    await svc.loans.handleNeedDecision('l-dev-sedra', 'u-dev', 'STILL_NEED');
    expect((await data.repos.notifications.findByUserId('u-dev')).length).toBe(before);
  });

  test('a DIGEST student gets one combined digest at the digest hour', async () => {
    await svc.loans.handleNeedDecision('l-leila-dsp', 'u-leila', 'STILL_NEED');
    await svc.notifications.notify({ userId: 'u-leila', kind: 'RESERVATION', title: 'Hold ready', message: 'x' });
    expect(await data.repos.notifications.findByUserId('u-leila')).toHaveLength(0);
    const pending = await data.repos.scheduledNotifications.findPendingByUserId('u-leila');
    expect(pending).toHaveLength(2);

    const digestAt = nextDigestTime(ANCHOR);
    expect((await svc.notifications.dispatchDue(new Date(digestAt.getTime() - 1))).delivered).toBe(0);
    expect((await svc.notifications.dispatchDue(digestAt)).delivered).toBe(1);
    const inbox = await data.repos.notifications.findByUserId('u-leila');
    expect(inbox).toHaveLength(1);
    expect(inbox[0].kind).toBe('DIGEST');
    expect(inbox[0].title).toContain('2 updates');
  });

  test('due-date reminders respect "marked for return" and are deduplicated', async () => {
    await svc.loans.handleNeedDecision('l-akash-os', 'u-akash', 'DONE');
    await svc.notifications.generateDueReminders(ANCHOR);
    await svc.notifications.generateDueReminders(ANCHOR);
    const titles = (await data.repos.notifications.findByUserId('u-akash')).map((n) => n.title);
    expect(titles.filter((t) => t === 'Due soon: Database System Concepts')).toHaveLength(1);
    expect(titles.some((t) => t.includes('Operating System Concepts') && t.startsWith('Due'))).toBe(false);
  });
});

describe('Persisted follow-ups', () => {
  test('NOT_SURE schedules exactly one follow-up which is delivered when due', async () => {
    await svc.loans.handleNeedDecision('l-akash-cn', 'u-akash', 'NOT_SURE');
    await svc.loans.handleNeedDecision('l-akash-cn', 'u-akash', 'NOT_SURE');
    const pending = await data.repos.scheduledNotifications.findPendingByUserId('u-akash');
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe('FOLLOW_UP');
    expect(pending[0].sendAt.getTime()).toBe(addDays(ANCHOR, 2).getTime());

    expect((await svc.notifications.dispatchDue(addDays(ANCHOR, 1))).delivered).toBe(0);
    expect((await svc.notifications.dispatchDue(addDays(ANCHOR, 2))).delivered).toBe(1);
    expect((await svc.notifications.dispatchDue(addDays(ANCHOR, 3))).delivered).toBe(0);
    const inbox = await data.repos.notifications.findByUserId('u-akash');
    expect(inbox.filter((n) => n.kind === 'FOLLOW_UP')).toHaveLength(1);
  });

  test('the follow-up is never scheduled after the due date', async () => {
    await svc.loans.handleNeedDecision('l-akash-os', 'u-akash', 'NOT_SURE'); // due in 1 day
    const [row] = await data.repos.scheduledNotifications.findPendingByUserId('u-akash');
    expect(row.sendAt.getTime()).toBeLessThanOrEqual(store.loans.get('l-akash-os')!.dueAt.getTime());
  });

  test('a later decision or a return cancels the pending follow-up', async () => {
    await svc.loans.handleNeedDecision('l-akash-cn', 'u-akash', 'NOT_SURE');
    await svc.loans.handleNeedDecision('l-akash-cn', 'u-akash', 'DONE');
    expect(await data.repos.scheduledNotifications.findPendingByUserId('u-akash')).toHaveLength(0);

    await svc.loans.handleNeedDecision('l-akash-dsc', 'u-akash', 'NOT_SURE');
    await svc.loans.returnLoan('l-akash-dsc', 'u-akash');
    expect(await data.repos.scheduledNotifications.findPendingByUserId('u-akash')).toHaveLength(0);
  });

  test('follow-ups for a QUIET student are recorded as suppressed, not sent', async () => {
    await svc.loans.handleNeedDecision('l-dev-sedra', 'u-dev', 'NOT_SURE');
    await svc.notifications.dispatchDue(addDays(ANCHOR, 3));
    expect(store.scheduledNotifications[0].status).toBe('SUPPRESSED');
    expect((await data.repos.notifications.findByUserId('u-dev')).some((n) => n.kind === 'FOLLOW_UP')).toBe(false);
  });
});

describe('Academic needs drive decisions', () => {
  test('a need beyond the due date that a renewal covers suggests renewing now', async () => {
    const { eligibility } = await svc.renewals.evaluateEligibility('l-akash-dsc', 'u-akash');
    expect(eligibility.academic_context).toMatchObject({
      topic: 'Database Normalisation',
      needed_beyond_due: true,
      renewal_covers_need: true,
      days_until_assessment: 7,
    });
    const centre = await svc.actions.getStudentActionCentre('u-akash');
    const item = centre.needsAttention.find((i) => i.loanId === 'l-akash-dsc')!;
    expect(item.actionLabel).toBe('Renew now');
    expect(item.why).toContain('Needed until');
  });

  test('a needed book that cannot be renewed points to alternatives, citing the need', async () => {
    const centre = await svc.actions.getStudentActionCentre('u-leila');
    const item = centre.needsAttention.find((i) => i.loanId === 'l-leila-dsp')!;
    expect(item.academicContext?.needed_beyond_due).toBe(true);
    expect(item.actionLabel).toBe('Find alternatives');
    expect(item.why).toContain('Maximum renewal limit');
  });

  test('an assessment soon after an outside-window due date still raises attention', async () => {
    // Akash's networks book is due in 18 days (normally not "needs attention").
    await data.repos.academicNeeds.create({
      userId: 'u-akash',
      course: 'CS303',
      topic: 'Routing',
      assessmentType: 'EXAM',
      assessmentDate: addDays(ANCHOR, 10),
      neededUntil: addDays(ANCHOR, 25),
    });
    const centre = await svc.actions.getStudentActionCentre('u-akash');
    expect(centre.needsAttention.some((i) => i.loanId === 'l-akash-cn')).toBe(true);
  });

  test('expired needs are ignored and urgency decays with assessment distance', () => {
    const need = {
      id: 'n',
      userId: 'u',
      course: 'x',
      topic: 'SQL',
      assessmentType: 'EXAM' as const,
      assessmentDate: addDays(ANCHOR, 3),
      neededUntil: addDays(ANCHOR, 3),
      createdAt: ANCHOR,
      updatedAt: ANCHOR,
    };
    expect(needUrgencyWeight(need, ANCHOR)).toBe(1);
    expect(needUrgencyWeight({ ...need, assessmentDate: addDays(ANCHOR, 15) }, ANCHOR)).toBe(0.7);
    expect(needUrgencyWeight({ ...need, assessmentDate: addDays(ANCHOR, 40), neededUntil: addDays(ANCHOR, 40) }, ANCHOR)).toBe(0.4);
    expect(isActiveNeed(need, addDays(ANCHOR, 4))).toBe(false);
    expect(needUrgencyWeight(need, addDays(ANCHOR, 4))).toBe(0);

    const book = store.books.get('b-dsc')!;
    const ctx = buildAcademicContext({
      book,
      needs: [need],
      topicLookup: store.topics,
      courseLookup: store.courses,
      dueAt: addDays(ANCHOR, 2),
      at: addDays(ANCHOR, 4),
    });
    expect(ctx).toBeNull();
  });

  test('alternatives cite the assessment and drop the boost once the need has passed', async () => {
    const live = await svc.alternatives.findAlternativesForBook('b-dsc', 'u-akash');
    expect(live.recommendations.some((r) => r.reasons.some((x) => x.includes('internal (in 7 days)')))).toBe(true);

    setClockOverride(addDays(ANCHOR, 9));
    const later = await svc.alternatives.findAlternativesForBook('b-dsc', 'u-akash');
    expect(later.recommendations.some((r) => r.reasons.some((x) => x.includes('for your internal')))).toBe(false);
  });
});

describe('Circulation races', () => {
  test('two students borrowing the last copy: exactly one succeeds', async () => {
    const copies = await data.repos.books.findCopiesByBookId('b-clrs');
    expect(copies.filter((c) => c.status === 'AVAILABLE')).toHaveLength(1);
    const results = await Promise.all([
      statusOf(svc.loans.borrowBook('b-clrs', 'u-aadya')),
      statusOf(svc.loans.borrowBook('b-clrs', 'u-priya')),
    ]);
    expect(results.sort()).toEqual([409, 'ok'].sort());
  });

  test('a restricted student cannot borrow', async () => {
    expect(await statusOf(svc.loans.borrowBook('b-elmasri', 'u-dev'))).toBe(403);
  });
});

describe('Recommendation benchmark', () => {
  test('Precision@5 is divided by k, so it is bounded by |relevant| / 5', async () => {
    const report = await runRecommendationBenchmark(data.repos, ANCHOR);
    const bound = BENCHMARK_QUERIES.reduce((s, q) => s + Math.min(q.relevantBookIds.length, 5) / 5, 0) / BENCHMARK_QUERIES.length;
    expect(report.hybridTfIdf.precisionAt5).toBeLessThanOrEqual(bound + 1e-9);
    expect(report.metadataOnly.precisionAt5).toBeLessThanOrEqual(bound + 1e-9);
  });

  test('the conclusion is derived from the numbers, including losses', () => {
    const base = { precisionAt5: 0.4, recallAt5: 0.8, ndcgAt5: 0.85, averageLatencyMs: 1, availabilityAwareRate: 0.7 };
    const worse = { ...base, ndcgAt5: 0.8, precisionAt5: 0.3 };
    const text = writeConclusion(compareMetrics(base, worse), 6, base, worse);
    expect(text).toContain('worse on');
    expect(text).toContain('metadata-only ranks better');
    expect(text).not.toContain('hybrid configuration is the better default');
  });
});

describe('JWT secret', () => {
  const env = { ...process.env };
  // Keep backend/.env out of these checks.
  beforeEach(() => jest.doMock('dotenv', () => ({ config: () => ({}) })));
  afterEach(() => {
    jest.dontMock('dotenv');
    process.env = { ...env };
    jest.resetModules();
  });

  test('production refuses to start without a strong JWT_SECRET', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    jest.isolateModules(() => {
      expect(() => require('../config')).toThrow(/JWT_SECRET/);
    });
    process.env.JWT_SECRET = 'replace-with-a-long-random-string';
    jest.isolateModules(() => {
      expect(() => require('../config')).toThrow(/JWT_SECRET/);
    });
  });

  test('there is no hard-coded fallback secret', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.JWT_SECRET;
    let a = '';
    let b = '';
    jest.isolateModules(() => {
      a = require('../config').config.jwtSecret;
    });
    jest.isolateModules(() => {
      b = require('../config').config.jwtSecret;
    });
    expect(a).not.toBe(b);
    expect(a).not.toContain('libtrack');
  });
});
