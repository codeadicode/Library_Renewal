import request from 'supertest';
import { createApp } from '../index';

describe('LibTrack REST API Endpoints', () => {
  const app = createApp();
  let akashToken: string;

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

  test('POST /api/auth/login accepts any password for a known student', async () => {
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ identifier: '1RZ25CS003', password: 'anything-at-all' });
    expect(wrong.status).toBe(200);
    expect(wrong.body.user.name).toBe('Aadya Dhuri');

    const none = await request(app).post('/api/auth/login').send({ identifier: 'aadya@campus.demo' });
    expect(none.status).toBe(200);

    const unknown = await request(app).post('/api/auth/login').send({ identifier: 'NOPE999', password: 'x' });
    expect(unknown.status).toBe(401);
  });

  test('PATCH /api/auth/profile edits the student profile', async () => {
    const login = await request(app).post('/api/auth/login').send({ identifier: '1RV25EC092' });
    const token = login.body.token;
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
    expect(res.body.reason_code).toBe('RENEWAL_SUCCESS');
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
    expect(res.body.currentBalance).toBeGreaterThanOrEqual(0);
  });

  test('GET /api/eval/recommendations runs benchmark evaluation', async () => {
    const res = await request(app)
      .get('/api/eval/recommendations')
      .set('Authorization', `Bearer ${akashToken}`);
    expect(res.status).toBe(200);
    expect(res.body.hybridTfIdf.ndcgAt5).toBeGreaterThan(0);
    expect(res.body.hybridTfIdf.averageLatencyMs).toBeLessThan(100);
  });
});

