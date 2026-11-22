# LibTrack
## Student Library Renewal & Learning Resource Continuity Assistant

LibTrack is a student-focused mobile utility and backend service designed to solve a core problem in campus libraries: **what happens when a student still needs a borrowed book, but cannot renew it?**

Instead of a generic Library Management System (LMS) with staff administration, procurement, and cataloguing burdens, LibTrack provides:
1. **Student Action Centre**: Due-date tracking prioritizing items needing immediate attention.
2. **Rule-Based Renewal Eligibility Engine**: Structured evaluation of library policies (overdue loans, active student reservations, max renewal counts, account restrictions, non-renewable items).
3. **"Still Need This Book?" Triage Workflow**: Three actionable paths (`YES, I STILL NEED IT`, `NO, I'M DONE WITH IT`, `I'M NOT SURE YET`) preventing unnecessary reminder spam.
4. **Explainable Alternative Resource Discovery (Core Differentiator)**: A 3-layer hybrid recommendation system (Layer 1 Metadata Jaccard + Layer 2 TF-IDF Cosine + Layer 3 Extensible Embedding Interface) with syllabus and course relevance, physical vs. digital availability separation, and clear human-readable "Why" explanations.
5. **Academic Needs Planner**: Optional student planner (courses, topics, exam/assessment deadlines) that boosts alternative resource rankings.
6. **Fine Tracking**: Transparent demo fine breakdown and late return cost estimations.

---

## Architecture & Technology Stack

- **Mobile Frontend**: React Native, Expo SDK 58, TypeScript, Expo Router (file-based navigation), TanStack Query, React Native StyleSheet, Lucide icons.
- **Backend Service**: Node.js, Express, TypeScript, Modular Monolith architecture, Zod validation, date-fns, bcryptjs, JSON Web Tokens (JWT).
- **Database & ORM**: PostgreSQL schema with Prisma ORM 6, with preloaded relational repository architecture for zero-config offline/testing execution.
- **Testing**: Jest, ts-jest, supertest (24 unit and integration test suites covering renewals, TF-IDF ranking, fine math, and REST endpoints).

```
Library_Renewal/
├── mobile/                  # Expo React Native Android-first mobile application
│   ├── app/                 # Expo Router routes (auth, tabs, book, decision, alternatives, needs, fines)
│   └── src/                 # Reusable UI, tokens, domain types, seed data, HTTP/mock API clients
├── backend/                 # Express + TypeScript + Prisma modular monolithic backend
│   ├── prisma/              # Prisma schema & database seed script
│   ├── src/                 # Controllers, services, repositories, recommendation engine, validators
│   ├── src/__tests__/       # Comprehensive Jest test suites (Renewal, Recommendations, REST APIs)
│   └── src/scripts/         # Recommendation benchmark evaluation script (P@5, NDCG@5, latency)
└── docs/                    # Architecture, database design, recommendation engine, and roadmap
```

---

## Demo Accounts & Scenarios

The system comes pre-seeded with 5 realistic student accounts and 25 academic textbooks:

**Any password works** (or none) — sign-in only checks the Student ID / email. The login screen also has one-tap buttons for each account.

| Student ID | Name | Scenario Demonstrated |
| :--- | :--- | :--- |
| `1RZ25CS003` | Aadya Dhuri | Two issued books (one due in 3 days), returned-book history, active reservation on the OS book. |
| `1RV25CS013` | Akash Tiwari | Mixed loans: renewable DBMS book, OS book blocked by an active reservation, on-track Networks book. |
| `1RV25EC045` | Leila Khan | Maximum renewals reached (2/2 allowed by policy). |
| `1RV25EC078` | Dev Nair | Restricted demo account (`ACCOUNT_RESTRICTED`). |
| `1RV25EC092` | Priya Sharma | Overdue loan (`LOAN_OVERDUE`), return workflow, and simulated fine calculation (₹5/day). |

App features: My Books tabs (Issued / Due / Overdue / Returned), Library catalogue showing available books with borrow/reserve, edit profile, and a Light / Dark / System theme switch (Profile → Appearance).

*(Email logins like `aadya@campus.demo` are also accepted).*

---

## Quickstart Instructions

### 1. Run the Backend Service

```bash
cd backend

# 1. Run automated tests (24 tests covering renewal, TF-IDF, and APIs)
npm test

# 2. Run recommendation benchmark evaluation (Precision@5, Recall@5, NDCG@5, latency)
npm run eval

# 3. Start development server on port 4000
npm run dev
```

The backend starts at `http://localhost:4000`. Test the health endpoint:
```bash
curl http://localhost:4000/api/health
```

### 2. Run the Mobile Application (Android / iOS)

```bash
cd mobile

# Verify TypeScript compilation
npm run typecheck

# Start Expo development server
npx expo start
```

- **Physical Android Phone**: Open **Expo Go** and scan the QR code displayed in the terminal.
- **Android Emulator**: Press `a` in the terminal (or run `npx expo start --android`).
- **Connecting Mobile to Backend**: Set `EXPO_PUBLIC_API_URL="http://10.0.2.2:4000"` (Android emulator) or `EXPO_PUBLIC_API_URL="http://<YOUR-PC-LAN-IP>:4000"` (physical phone on same Wi-Fi). If unset or the backend is offline, the app seamlessly falls back to its local simulated engine.

---

## Recommendation Benchmark Results

Run `npm run eval` in `backend` to run the benchmark:

```text
METRIC                         | METADATA-ONLY | HYBRID (METADATA + TF-IDF)
-------------------------------+---------------+---------------------------
Precision@5                    | 0.7542        | 0.3500
Recall@5                       | 1.0000        | 0.7083
NDCG@5                         | 0.9564        | 0.7573
Availability-Aware Rec Rate    | 57.1%          | 85.0%
Average Latency                | 1.45 ms       | 0.99 ms
```
The hybrid engine executes in **under 2 milliseconds**, ensuring instant responsiveness on mobile devices while surfacing accessible alternative textbooks covering the required syllabus topics.

---

## Technical Documentation

- [Architecture Overview](docs/architecture.md)
- [Recommendation Engine Specification](docs/recommendation-engine.md)
- [Database Schema & Cardinalities](docs/database-design.md)
- [Implementation Roadmap](docs/implementation-roadmap.md)
