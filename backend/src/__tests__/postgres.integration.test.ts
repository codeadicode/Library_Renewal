/**
 * Integration tests against a real PostgreSQL database.
 *
 *   docker compose up -d db
 *   TEST_DATABASE_URL=postgresql://libtrack:libtrack@localhost:5432/libtrack_test npm run test:db
 *
 * The database named by TEST_DATABASE_URL is migrated and re-seeded first,
 * so never point it at data you want to keep. Skipped unless RUN_DB_TESTS=1.
 */
import { execSync } from 'child_process';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

const RUN = process.env.RUN_DB_TESTS === '1';
const TEST_DB = process.env.TEST_DATABASE_URL || 'postgresql://libtrack:libtrack@localhost:5432/libtrack_test';
const ANCHOR = '2026-11-21T06:30:00.000Z';

const suite = RUN ? describe : describe.skip;

suite('PostgreSQL data store (integration)', () => {
  // Loaded lazily so DATABASE_URL points at the test database before Prisma reads it.
  let PrismaDataStore: typeof import('../repositories/prismaRepositories').PrismaDataStore;
  let createServices: typeof import('../services').createServices;
  let createApp: typeof import('../index').createApp;
  let setClockOverride: typeof import('../lib/clock').setClockOverride;

  const open: Array<{ disconnect(): Promise<void> }> = [];
  const newStore = () => {
    const store = new PrismaDataStore(new PrismaClient({ datasources: { db: { url: TEST_DB } } }));
    open.push(store);
    return store;
  };

  beforeAll(() => {
    const cwd = path.resolve(__dirname, '../..');
    const env = { ...process.env, DATABASE_URL: TEST_DB, DEMO_NOW: ANCHOR, NODE_ENV: 'test' };
    execSync('npx prisma migrate deploy', { cwd, env, stdio: 'pipe' });
    execSync('npx ts-node src/prisma/seed.ts', { cwd, env, stdio: 'pipe' });

    process.env.DATABASE_URL = TEST_DB;
    ({ PrismaDataStore } = require('../repositories/prismaRepositories'));
    ({ createServices } = require('../services'));
    ({ createApp } = require('../index'));
    ({ setClockOverride } = require('../lib/clock'));
    setClockOverride(new Date(ANCHOR));
  }, 180_000);

  afterAll(async () => {
    setClockOverride?.(null);
    await Promise.all(open.map((s) => s.disconnect()));
  });

  test('the API reports PostgreSQL as its data store and authenticates against it', async () => {
    const app = createApp(newStore());
    const health = await request(app).get('/api/health');
    expect(health.body).toMatchObject({ dataStore: 'postgres', database: 'ok' });

    expect((await request(app).post('/api/auth/login').send({ identifier: '1RV25CS013', password: 'nope' })).status).toBe(401);
    const ok = await request(app).post('/api/auth/login').send({ identifier: '1RV25CS013', password: 'demo1234' });
    expect(ok.status).toBe(200);

    const books = await request(app).get('/api/books').set('Authorization', `Bearer ${ok.body.token}`);
    expect(books.body.books).toHaveLength(33);
  });

  test('the full demonstration dataset is seeded', async () => {
    const { repos } = newStore();
    expect((await repos.books.findAll()).length).toBe(33);
    expect((await repos.loans.findById('l-priya-sadiku'))!.status).toBe('OVERDUE');
    expect((await repos.loans.findById('l-priya-opp-returned'))!.status).toBe('RETURNED');
    expect((await repos.reservations.findActiveByBookId('b-oscon')).length).toBe(1);
    expect((await repos.fines.findByUserId('u-priya'))[0].amount).toBe(15);
    expect((await repos.renewalAttempts.findByLoanId('l-leila-dsp')).length).toBe(2);
  });

  test('concurrent renewals are serialised by the row lock', async () => {
    const services = createServices(newStore());
    const results = await Promise.all(
      Array.from({ length: 6 }, () => services.renewals.processRenewal('l-akash-dsc', 'u-akash')),
    );
    expect(results.filter((r) => r.success)).toHaveLength(2);

    const loan = await services.store.repos.loans.findById('l-akash-dsc');
    expect(loan!.renewalCount).toBe(2);
    const history = await services.store.repos.renewalAttempts.findByLoanId('l-akash-dsc');
    expect(history.filter((a) => a.reasonCode === 'RENEWAL_SUCCESS')).toHaveLength(2);
  });

  test('changes survive a restart (new connection pool)', async () => {
    const first = createServices(newStore());
    await first.loans.handleNeedDecision('l-aadya-os', 'u-aadya', 'NOT_SURE');
    await first.store.disconnect();

    const second = newStore();
    const loan = await second.repos.loans.findById('l-aadya-os');
    expect(loan!.needDecision).toBe('NOT_SURE');
    const pending = await second.repos.scheduledNotifications.findPendingByUserId('u-aadya');
    expect(pending.filter((p) => p.kind === 'FOLLOW_UP')).toHaveLength(1);
  });

  test('a failed transaction leaves no partial writes', async () => {
    const store = newStore();
    await expect(
      store.transaction(async (tx) => {
        await tx.loans.update('l-dev-sedra', { renewalCount: 99 });
        await tx.renewalAttempts.create({ loanId: 'l-dev-sedra', eligible: true, reasonCode: 'X', reason: 'x', newDueAt: null });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect((await store.repos.loans.findById('l-dev-sedra'))!.renewalCount).toBe(0);
    expect(await store.repos.renewalAttempts.findByLoanId('l-dev-sedra')).toHaveLength(0);
  });

  test('fine amounts round-trip through DECIMAL exactly', async () => {
    const { repos } = newStore();
    await repos.fines.create({ userId: 'u-dev', loanId: null, amount: 0.1, reason: 'a' });
    await repos.fines.create({ userId: 'u-dev', loanId: null, amount: 0.2, reason: 'b' });
    const services = createServices(newStore());
    expect((await services.fines.getUserFines('u-dev')).ledger.total).toBe(0.3);
  });

  test('returning an overdue loan moves the estimate into the ledger once', async () => {
    const services = createServices(newStore());
    const before = await services.fines.getUserFines('u-priya');
    expect(before.ledger.total).toBe(15);
    expect(before.estimates.total).toBe(20);

    const [a, b] = await Promise.allSettled([
      services.loans.returnLoan('l-priya-sadiku', 'u-priya'),
      services.loans.returnLoan('l-priya-sadiku', 'u-priya'),
    ]);
    expect([a.status, b.status].sort()).toEqual(['fulfilled', 'rejected']);

    const after = await services.fines.getUserFines('u-priya');
    expect(after.ledger.total).toBe(35);
    expect(after.estimates.total).toBe(0);
    expect((await services.store.repos.books.findCopyById('c-sad-1'))!.status).toBe('AVAILABLE');
  });

  test('two students racing for the last copy: exactly one borrow succeeds', async () => {
    const services = createServices(newStore());
    const results = await Promise.allSettled([
      services.loans.borrowBook('b-clrs', 'u-aadya'),
      services.loans.borrowBook('b-clrs', 'u-leila'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await services.store.repos.books.countAvailablePhysicalCopies('b-clrs')).toBe(0);
  });

  test('the database rejects a second active reservation for the same student and title', async () => {
    const { repos } = newStore();
    await repos.reservations.create({ bookId: 'b-kurose', userId: 'u-leila', status: 'ACTIVE' });
    await expect(repos.reservations.create({ bookId: 'b-kurose', userId: 'u-leila', status: 'ACTIVE' })).rejects.toThrow();
  });
});
