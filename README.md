# LibTrack
## Student Library Renewal & Learning Resource Continuity Assistant

LibTrack is a student-focused mobile app and backend service for one core problem in campus libraries: **what happens when a student still needs a borrowed book but cannot renew it?**

Instead of a general library management system, LibTrack provides:

1. **Student Action Centre**: loans ranked by what needs attention now, with a suggested next step and the reason for it.
2. **Rule-based renewal eligibility**: returned loans, overdue loans, account restrictions, non-renewable titles, other students' reservations and the renewal limit, each with an explanation.
3. **"Still need this book?" triage**: *Yes* / *No, I'm done* / *Not sure yet*. "Not sure" schedules exactly one follow-up, which is saved in the database and survives restarts.
4. **Academic needs planner**: assessment dates and "needed until" dates decide whether a renewal is enough, push loans needed past their due date up the dashboard, and weight alternative recommendations by how close the assessment is.
5. **Explainable alternatives**: a hybrid recommender (metadata Jaccard + TF-IDF cosine, with an embedding hook) that ranks available titles first and explains every suggestion.
6. **Fines, kept honest**: amounts **owed** (fine ledger) and amounts **accruing** (estimates on open overdue loans) are shown separately and never added together. Money is stored as `DECIMAL(10,2)` and calculated in paise.
7. **Notification preferences that work**: Normal, Important only, Daily digest and Quiet are applied on the server to every reminder, confirmation and follow-up.

---

## Architecture

- **Mobile**: React Native, Expo SDK 58, TypeScript, Expo Router, TanStack Query, `expo-secure-store` (session and theme persistence).
- **Backend**: Node.js, Express, TypeScript modular monolith, Zod, bcryptjs, JWT.
- **Database**: **PostgreSQL via Prisma** (default and only persistent store). An in-memory store with the same interface exists for unit tests and offline demos (`DATA_STORE=memory`).
- **Tests**: Jest + supertest unit/API suites, a PostgreSQL integration suite (`npm run test:db`).

```
Library_Renewal/
├── docker-compose.yml       # Local PostgreSQL 16
├── mobile/                  # Expo app
│   ├── app/                 # Expo Router screens
│   └── src/api/             # One LibraryApi interface: httpClient (API mode) + mockStore (offline)
├── backend/
│   ├── prisma/              # schema.prisma + SQL migrations
│   ├── src/data/            # Single demo dataset used by the seed and the memory store
│   ├── src/repositories/    # Prisma repositories, memory repositories, DataStore + transactions
│   ├── src/services/        # Renewal, loans, fines, notifications/scheduler, action centre…
│   ├── src/recommendation/  # Engine + benchmark (shared by `npm run eval` and the API)
│   └── src/__tests__/       # Unit, API, edge-case and PostgreSQL integration tests
└── docs/
```

---

## Quickstart

Requirements: Node.js 20+, Docker (for PostgreSQL), and Expo Go or an emulator.

### 1. Database and backend

```bash
docker compose up -d db          # PostgreSQL on localhost:5432

cd backend
cp .env.example .env             # then set JWT_SECRET (see the file for a one-line generator)
npm install                      # also generates the Prisma client
npm run db:setup                 # apply migrations + load the full demo dataset
npm run dev                      # API on http://localhost:4000
```

Check it is running on PostgreSQL:

```bash
curl http://localhost:4000/api/health
# {"status":"OK","dataStore":"postgres","database":"ok",...}
```

Data persists across backend restarts. `npm run db:seed` resets the demo students' loans to a fresh state at any time; accounts you registered are kept.

### 2. Mobile app

```bash
cd mobile
cp .env.example .env             # set EXPO_PUBLIC_API_URL for your device
npm install
npx expo start
```

| Where the app runs | `EXPO_PUBLIC_API_URL` |
| :--- | :--- |
| Android emulator | `http://10.0.2.2:4000` |
| Physical phone (same Wi-Fi) | `http://<your-computer-LAN-IP>:4000` |
| Web / iOS simulator | `http://localhost:4000` |
| Offline demo, no backend | leave unset |

With `EXPO_PUBLIC_API_URL` set, **every** screen (catalogue, availability, loans, eligibility, actions, fines, notifications) uses the backend. Errors are shown, with no silent fallback to mock data. Sign-in is stored in SecureStore and restored on launch; an expired session returns you to the login screen.

---

## Demo accounts

All demo students use the password **`demo1234`**. The login screen has one-tap buttons for each.

| Student ID | Name | Scenario |
| :--- | :--- | :--- |
| `1RV25CS013` | Akash Tiwari | Renewable DBMS book needed for an internal in 7 days (one renewal covers it); OS book blocked by a reservation; on-track Networks book. |
| `1RZ25CS003` | Aadya Dhuri | Book due in 3 days; holds the reservation that blocks Akash. |
| `1RV25EC045` | Leila Khan | DSP book at the renewal limit (2/2) but needed for a project in 14 days, so the app points to alternatives. Preference: daily digest. |
| `1RV25EC078` | Dev Nair | Restricted account (`ACCOUNT_RESTRICTED`). Preference: quiet. |
| `1RV25EC092` | Priya Sharma | Open overdue loan (₹20 accruing, estimate only) plus a past late return (₹15 owed in the ledger). |

Email logins such as `akash@campus.demo` also work.

---

## Demo clock

Loans are seeded relative to "now", so a freshly seeded database always shows the scenarios above. To pin the date for a presentation:

```bash
# backend/.env
DEMO_NOW=2026-11-21T09:00:00+05:30
# mobile/.env (keep the same value)
EXPO_PUBLIC_DEMO_NOW=2026-11-21T09:00:00+05:30
```

Re-run `npm run db:seed` after changing `DEMO_NOW`. `/api/health` reports the clock the API is using. In offline mock mode the app defaults to the date the bundled mock data was written for.

---

## Tests

```bash
cd backend
npm test             # unit, API and edge-case suites (in-memory store, no database needed)
npm run test:db      # PostgreSQL integration suite (uses and wipes the libtrack_test database)
npm run typecheck

cd ../mobile
npm run typecheck
```

For `test:db`, create the test database once with `docker exec libtrack-postgres psql -U libtrack -c "CREATE DATABASE libtrack_test"`, or point `TEST_DATABASE_URL` elsewhere.

The edge-case suite covers: renewal of returned loans, concurrent renewals against the limit, renewal/audit atomicity (rollback), fine-estimate ownership, derived OVERDUE status, paisa-exact money, ledger vs estimate separation, notification preference routing and digests, persisted follow-ups (delivery, cancellation, never after the due date), academic-need timing, the borrow race for the last copy, benchmark maths and JWT secret enforcement. The PostgreSQL suite repeats the concurrency, atomicity, persistence and money checks against a real database.

---

## Recommendation benchmark

`npm run eval` (and `GET /api/eval/recommendations`) run the same 6 manually judged queries with k = 5. Precision@5 is always divided by k. The conclusion is generated from the measured numbers, including any metric where the hybrid is worse.

```text
METRIC                    | METADATA-ONLY | HYBRID   | DELTA    | BETTER
--------------------------+---------------+----------+----------+-------------
Precision@5               | 0.4333        | 0.4667   | +0.0334  | hybrid
Recall@5                  | 0.8611        | 0.9167   | +0.0556  | hybrid
NDCG@5                    | 0.8531        | 0.8922   | +0.0391  | hybrid
Availability-aware rate   | 0.7647        | 0.7000   | -0.0647  | metadataOnly
```

On this benchmark the hybrid ranks better (NDCG@5), but it surfaces slightly fewer immediately available titles. With 6 queries these differences are indicative, not statistically significant. Latency is under 1 ms per query for both configurations and is not used for comparison.

---

## Documentation

- [Backend README](backend/README.md): API, scripts, data model notes
- [Mobile README](mobile/README.md): modes, session, theming
- [Architecture](docs/architecture.md) · [Recommendation engine](docs/recommendation-engine.md) · [Database design](docs/database-design.md) · [Roadmap](docs/implementation-roadmap.md)
