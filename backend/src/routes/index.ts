import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth';
import { Services } from '../services';
import { AuthController } from '../controllers/AuthController';
import { BookController } from '../controllers/BookController';
import { LoanController } from '../controllers/LoanController';
import { RenewalController } from '../controllers/RenewalController';
import { AlternativeController } from '../controllers/AlternativeController';
import { AcademicNeedController } from '../controllers/AcademicNeedController';
import { ActionController } from '../controllers/ActionController';
import { NotificationController } from '../controllers/NotificationController';
import { FineController } from '../controllers/FineController';
import { runRecommendationBenchmark } from '../recommendation/benchmark';
import { now } from '../lib/clock';

export function createApiRouter(services: Services): Router {
  const router = Router();
  const auth = createAuthMiddleware(services.auth);

  const authCtrl = new AuthController(services.auth);
  const bookCtrl = new BookController(services.books);
  const loanCtrl = new LoanController(services.loans);
  const renewalCtrl = new RenewalController(services.renewals);
  const altCtrl = new AlternativeController(services.alternatives);
  const needCtrl = new AcademicNeedController(services.store.repos.academicNeeds);
  const actionCtrl = new ActionController(services.actions);
  const notifCtrl = new NotificationController(services.notifications);
  const fineCtrl = new FineController(services.fines);

  router.get('/health', async (_req, res) => {
    let database: 'ok' | 'unreachable' = 'ok';
    try {
      await services.store.ping();
    } catch {
      database = 'unreachable';
    }
    res.status(database === 'ok' ? 200 : 503).json({
      status: database === 'ok' ? 'OK' : 'DEGRADED',
      service: 'LibTrack Modular Monolith API',
      dataStore: services.store.driver,
      database,
      // The clock the API is using (pinned when DEMO_NOW is set).
      now: now().toISOString(),
      timestamp: new Date().toISOString(),
    });
  });

  // Auth
  router.post('/auth/register', authCtrl.register);
  router.post('/auth/login', authCtrl.login);
  router.get('/auth/me', auth, authCtrl.getMe);
  router.patch('/auth/preferences', auth, authCtrl.updatePreferences);
  router.patch('/auth/profile', auth, authCtrl.updateProfile);

  // Catalogue
  router.get('/books/topics', auth, bookCtrl.getTopics);
  router.get('/books/courses', auth, bookCtrl.getCourses);
  router.get('/books/search', auth, bookCtrl.getBooks);
  router.get('/books', auth, bookCtrl.getBooks);
  router.get('/books/:id', auth, bookCtrl.getBookById);
  router.post('/books/:id/reserve', auth, bookCtrl.reserveBook);
  router.post('/books/:id/borrow', auth, loanCtrl.borrowBook);
  router.get('/books/:id/alternatives', auth, altCtrl.getAlternativesForBook);

  // Loans
  router.get('/loans', auth, loanCtrl.getMyLoans);
  router.get('/loans/:id', auth, loanCtrl.getLoanById);
  router.post('/loans/:id/decision', auth, loanCtrl.submitNeedDecision);
  router.post('/loans/:id/return', auth, loanCtrl.returnLoan);

  // Renewal
  router.get('/loans/:id/eligibility', auth, renewalCtrl.checkEligibility);
  router.post('/loans/:id/renew', auth, renewalCtrl.renewLoan);
  router.get('/loans/:id/renewal-history', auth, renewalCtrl.getRenewalHistory);

  // Academic needs planner
  router.get('/academic-needs', auth, needCtrl.getNeeds);
  router.post('/academic-needs', auth, needCtrl.createNeed);
  router.patch('/academic-needs/:id', auth, needCtrl.updateNeed);
  router.delete('/academic-needs/:id', auth, needCtrl.deleteNeed);

  // Action centre
  router.get('/actions', auth, actionCtrl.getActions);

  // Notifications
  router.get('/notifications', auth, notifCtrl.getNotifications);
  router.get('/notifications/scheduled', auth, notifCtrl.getScheduled);
  router.patch('/notifications/:id/read', auth, notifCtrl.markAsRead);

  // Fines
  router.get('/fines', auth, fineCtrl.getFines);
  router.get('/fines/estimate/:loanId', auth, fineCtrl.estimateFine);

  // Recommendation benchmark (same queries and code path as `npm run eval`)
  router.get('/eval/recommendations', auth, async (_req, res, next) => {
    try {
      res.status(200).json(await runRecommendationBenchmark(services.store.repos));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
