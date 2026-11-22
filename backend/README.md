# LibTrack backend

Express + TypeScript modular monolith on **PostgreSQL (Prisma)**.

## Setup

```bash
docker compose up -d db          # from the repo root
cp .env.example .env             # set JWT_SECRET
npm install
npm run db:setup                 # migrate + seed
npm run dev
```

| Script | What it does |
| :--- | :--- |
| `npm run dev` | Start the API with ts-node (PostgreSQL). |
| `npm run dev:memory` | Start on the in-memory store (offline demo; nothing persists). |
| `npm run build` / `npm start` | Compile to `dist/` and run it. |
| `npm run db:migrate` | Apply migrations (`prisma migrate deploy`). |
| `npm run db:seed` | Load or refresh the full demo dataset. |
| `npm run db:setup` | Migrate, then seed. |
| `npm run db:reset` | Drop everything and re-apply migrations (`prisma migrate reset`). |
| `npm run eval` | Recommendation benchmark (`-- --memory` to run without a database). |
| `npm test` | Unit, API and edge-case suites (memory store). |
| `npm run test:db` | PostgreSQL integration suite against `TEST_DATABASE_URL`. |

## Configuration

See `.env.example`. The main settings:

- `DATABASE_URL`: required unless `DATA_STORE=memory`.
- `JWT_SECRET`: at least 32 random characters. With `NODE_ENV=production` the server refuses to start without one; there is no built-in fallback. In development an unset secret gives a random per-process one, so sessions end on restart.
- `DATA_STORE`: `postgres` (default) or `memory`.
- `DEMO_NOW`: pins the application clock. The seed dates loans relative to it.
- `SCHEDULER_INTERVAL_MS`, `DIGEST_HOUR`: notification scheduler.

## Design notes

**Data access.** Services depend on repository interfaces (`src/repositories/interfaces.ts`). `PrismaDataStore` implements them on PostgreSQL. `MemoryDataStore` implements them in memory for tests, with serialised transactions that roll back on error. `DataStore.transaction()` gives a unit of work.

**Renewal.** `POST /loans/:id/renew` runs in one transaction: `SELECT … FOR UPDATE` on the loan, re-evaluates eligibility, updates the loan and writes the `RenewalAttempt` audit row. Concurrent renewals queue behind the lock, so the renewal limit cannot be exceeded and a renewal never exists without its audit row. Returned loans are refused with `LOAN_RETURNED`.

**Loan status.** Only `ACTIVE` and `RETURNED` are stored. `OVERDUE` is derived from `dueAt` and the clock on every read, so the status can never disagree with the due date.

**Money.** `FineLedger.amount` and `LibraryPolicy.finePerDay` are `DECIMAL(10,2)`. Arithmetic uses integer paise (`src/lib/money.ts`).

**Fines.** `GET /fines` returns `ledger` (recorded charges, owed) and `estimates` (open overdue loans if returned today, not owed) separately. Returning a late book moves the amount into the ledger exactly once. `GET /fines/estimate/:loanId` only works for your own loans.

**Notifications.** Every notification goes through `NotificationService.notify`, which applies the user's preference:

| Preference | HIGH (overdue, due today, blocked, follow-up) | NORMAL (due soon, renewal available, holds) | LOW (confirmations) |
| :--- | :--- | :--- | :--- |
| NORMAL | immediately | immediately | immediately |
| IMPORTANT | immediately | dropped | dropped |
| DIGEST | immediately | in the daily digest | in the daily digest |
| QUIET | overdue only | dropped | dropped |

"Not sure" decisions create a `ScheduledNotification` (persisted, so it survives restarts). The scheduler delivers it when due. Before sending it re-checks the loan and the user's current preference, and it cancels the follow-up if the student decided or returned the book. The scheduler also produces de-duplicated due-soon and overdue reminders, and skips due-soon reminders for books marked for return.

**Academic needs.** Each eligibility response includes `academic_context`: the most constraining active need for the book, whether it extends past the due date, and whether one renewal would cover it. The action centre uses this for urgency and advice ("Renew now", "Renew + find backup", "Find alternatives"). The recommender ignores expired needs and weights active ones by how close the assessment is.

**Integrity in SQL.** The migration adds partial unique indexes (one open loan per copy, one active hold per student per title) and CHECK constraints (non-negative fines, renewal counts, `returnedAt` consistent with status).

## API summary

All routes are under `/api`. Every route except `health`, `auth/login` and `auth/register` needs `Authorization: Bearer <token>`.

| Method & path | Purpose |
| :--- | :--- |
| `GET /health` | Status, data store, DB reachability, current clock |
| `POST /auth/register`, `POST /auth/login` | Password required (min 8 chars to register) |
| `GET /auth/me`, `PATCH /auth/profile`, `PATCH /auth/preferences` | Profile and notification preference |
| `GET /policy` | Borrowing policy values the app displays |
| `GET /books`, `GET /books/:id`, `GET /books/topics`, `GET /books/courses` | Catalogue + live availability |
| `POST /books/:id/borrow`, `POST /books/:id/reserve` | Simulated issue desk / hold |
| `GET /books/:id/alternatives` | Ranked, explained alternatives |
| `GET /loans`, `GET /loans/:id` | Your loans (status derived) |
| `GET /loans/:id/eligibility`, `POST /loans/:id/renew`, `GET /loans/:id/renewal-history` | Renewal |
| `POST /loans/:id/decision`, `POST /loans/:id/return` | Triage and simulated return |
| `GET /actions` | Action centre: per-loan eligibility, academic context, prioritised actions |
| `GET/POST/PATCH/DELETE /academic-needs` | Planner (needed-until cannot be in the past or before the assessment) |
| `GET /notifications`, `GET /notifications/scheduled`, `PATCH /notifications/:id/read` | Inbox and pending follow-ups |
| `GET /fines`, `GET /fines/estimate/:loanId` | Ledger vs estimates |
| `GET /eval/recommendations` | Benchmark report |
