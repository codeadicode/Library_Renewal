import request from 'supertest';
import { createApp } from '../index';
import { MemoryDataStore, MemoryStore } from '../repositories/memoryStore';
import { setClockOverride } from '../lib/clock';

const ANCHOR = new Date('2026-11-21T06:30:00Z');
setClockOverride(ANCHOR);

const login = (app: ReturnType<typeof createApp>, identifier: string, password = 'demo1234') =>
  request(app).post('/api/auth/login').send({ identifier, password });

describe('LibTrack REST API Endpoints', () => {
  const app = createApp(new MemoryDataStore(new MemoryStore(ANCHOR)));
  let akashToken: string;

  afterAll(() => setClockOverride(null));

  beforeAll(async () => {
    // Login as Akash Tiwari (1RV25CS013)
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: '1RV25CS013', password: 'demo1234' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    akashToken = res.body.token;
  });

  test('GET /api/health returns service status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  test('GET /api/auth/me returns authenticated student profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${akashToken}`);
    expect(res.status).toBe(200);
    expect(res.body.studentId).toBe('1RV25CS013');
    expect(res.body.name).toBe('Akash Tiwari');
  });

  test('POST /api/auth/login requires the correct password', async () => {
    const ok = await login(app, 'aadya@campus.demo');
    expect(ok.status).toBe(200);
    expect(ok.body.user.name).toBe('Aadya Dhuri');
    expect(ok.body.user.passwordHash).toBeUndefined();

    const wrong = await login(app, '1RZ25CS003', 'anything-at-all');
    expect(wrong.status).toBe(401);

    const none = await request(app).post('/api/auth/login').send({ identifier: 'aadya@campus.demo' });
    expect(none.status).toBe(400);

    const empty = await login(app, 'aadya@campus.demo', '');
    expect(empty.status).toBe(400);

    const unknown = await login(app, 'NOPE999', 'x');
    expect(unknown.status).toBe(401);
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  test('JWT carries identifiers only, not the profile', async () => {
    const res = await login(app, '1RV25CS013');
    const payload = JSON.parse(Buffer.from(res.body.token.split('.')[1], 'base64url').toString());
    expect(payload.sub).toBe('u-akash');
    expect(payload.restricted).toBeUndefined();
    expect(payload.email).toBeUndefined();
  });

  test('POST /api/auth/register rejects short passwords and stores a hash', async () => {
    const base = { studentId: 'NEW001', name: 'New Student', course: 'CSE', academicYear: 'Year 1' };
    const weak = await request(app)
      .post('/api/auth/register')
      .send({ ...base, email: 'new@campus.demo', password: 'short' });
    expect(weak.status).toBe(400);

    const ok = await request(app)
      .post('/api/auth/register')
      .send({ ...base, email: 'New@Campus.demo', password: 'a-strong-password' });
    expect(ok.status).toBe(201);
    expect(ok.body.user.email).toBe('new@campus.demo');
    expect((await login(app, 'NEW001', 'a-strong-password')).status).toBe(200);
    expect((await login(app, 'NEW001', 'wrong-password')).status).toBe(401);
  });

  test('PATCH /api/auth/profile edits the student profile', async () => {
    const token = (await login(app, '1RV25EC092')).body.token;
    const res = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Priya S', academicYear: 'Year 3' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Priya S');
    expect(res.body.academicYear).toBe('Year 3');
    expect(res.body.passwordHash).toBeUndefined();

    const clash = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'akash@campus.demo' });
    expect(clash.status).toBe(409);
  });

  test('GET /api/books returns catalogue books with search and filter', async () => {
    const res = await request(app)
      .get('/api/books?q=Database')
      .set('Authorization', `Bearer ${akashToken}`);
    expect(res.status).toBe(200);
    expect(res.body.books.length).toBeGreaterThan(0);
    expect(res.body.books[0].category).toBe('Databases');
  });

  test('GET /api/loans returns only loans belonging to the authenticated student', async () => {
    const res = await request(app)
      .get('/api/loans')
      .set('Authorization', `Bearer ${akashToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const loan of res.body) {
      expect(loan.userId).toBe('u-akash');
    }
  });

  test('GET /api/loans/:id/eligibility checks rule-based renewal eligibility', async () => {
    const res = await request(app)
      .get('/api/loans/l-akash-dsc/eligibility')
      .set('Authorization', `Bearer ${akashToken}`);
    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(true);
    expect(res.body.reason_code).toBe('ELIGIBLE');
  });

  test('POST /api/loans/:id/decision saves still-need triage decision', async () => {
    const res = await request(app)
      .post('/api/loans/l-akash-dsc/decision')
      .set('Authorization', `Bearer ${akashToken}`)
      .send({ decision: 'STILL_NEED' });
    expect(res.status).toBe(200);
    expect(res.body.needDecision).toBe('STILL_NEED');
  });

  test('POST /api/loans/:id/renew successfully executes renewal for eligible loan', async () => {
    const res = await request(app)
      .post('/api/loans/l-akash-dsc/renew')
      .set('Authorization', `Bearer ${akashToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.loan.renewalCount).toBe(1);
  });

  test('GET /api/books/:id/alternatives returns ranked learning alternatives', async () => {
    const res = await request(app)
      .get('/api/books/b-dsc/alternatives')
      .set('Authorization', `Bearer ${akashToken}`);
    expect(res.status).toBe(200);
    expect(res.body.sourceBook.title).toBe('Database System Concepts');
    expect(res.body.recommendations.length).toBeGreaterThan(0);
    expect(res.body.recommendations[0].reasons.length).toBeGreaterThan(0);
  });

  test('GET /api/actions returns prioritized student action centre feed', async () => {
    const res = await request(app)
      .get('/api/actions')
      .set('Authorization', `Bearer ${akashToken}`);
    expect(res.status).toBe(200);
    expect(res.body.stats).toBeDefined();
    expect(res.body.needsAttention.length).toBeGreaterThan(0);
  });

  test('Academic Needs CRUD operations', async () => {
    // 1. Create
    const createRes = await request(app)
      .post('/api/academic-needs')
      .set('Authorization', `Bearer ${akashToken}`)
      .send({
        course: 'CS301',
        topic: 'Relational Algebra',
        assessmentType: 'PROJECT',
        assessmentDate: '2026-12-05',
        neededUntil: '2026-12-05',
      });
    expect(createRes.status).toBe(201);

    const auth = { Authorization: 'Bearer ' + akashToken };
    const past = await request(app)
      .post('/api/academic-needs')
      .set(auth)
      .send({ course: 'CS301', topic: 'SQL', assessmentType: 'EXAM', assessmentDate: '2026-11-01', neededUntil: '2026-11-02' });
    expect(past.status).toBe(400);

    const inverted = await request(app)
      .post('/api/academic-needs')
      .set(auth)
      .send({ course: 'CS301', topic: 'SQL', assessmentType: 'EXAM', assessmentDate: '2026-12-10', neededUntil: '2026-12-01' });
    expect(inverted.status).toBe(400);
    const needId = createRes.body.id;

    // 2. Read
    const getRes = await request(app)
      .get('/api/academic-needs')
      .set('Authorization', `Bearer ${akashToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.some((n: any) => n.id === needId)).toBe(true);

    // 3. Delete
    const delRes = await request(app)
      .delete(`/api/academic-needs/${needId}`)
      .set('Authorization', `Bearer ${akashToken}`);
    expect(delRes.status).toBe(200);
  });

  test('GET /api/fines returns simulated balance and fine policy rates', async () => {
    const res = await request(app)
      .get('/api/fines')
      .set('Authorization', `Bearer ${akashToken}`);
    expect(res.status).toBe(200);
    expect(res.body.dailyRate).toBe(5);
    expect(res.body.ledger.total).toBeGreaterThanOrEqual(0);
    expect(res.body.estimates.total).toBe(0);
  });

  test('GET /api/eval/recommendations runs benchmark evaluation', async () => {
    const res = await request(app)
      .get('/api/eval/recommendations')
      .set('Authorization', `Bearer ${akashToken}`);
    expect(res.status).toBe(200);
    expect(res.body.hybridTfIdf.ndcgAt5).toBeGreaterThan(0);
    expect(res.body.hybridTfIdf.averageLatencyMs).toBeLessThan(100);
    expect(res.body.queryCount).toBe(6);
    expect(typeof res.body.conclusion).toBe('string');
    expect(res.body.comparison).toHaveLength(4);
  });
});

