# LibTrack Architecture

LibTrack is a **student-facing** borrowing, renewal, and learning-resource continuity app. It is **not** a library management system: there is no librarian admin, procurement, staff, or acquisitions.

This document is the technical plan. **Phase 1 implements only the mobile foundation** with mock data. Backend services described here are designed now and built in later phases.

## Confirmed stack

| Layer | Choice |
| --- | --- |
| Mobile | React Native, Expo, TypeScript, Expo Router, Android-first, iOS-compatible |
| Data fetching | TanStack Query (wired in Phase 1 against a mock client) |
| Auth storage (later) | Expo SecureStore |
| Notifications (later) | Expo Notifications (local first) |
| Backend | Node.js, Express, TypeScript, REST, modular monolith |
| Database | PostgreSQL + Prisma |
| Validation | Zod |
| Dates | date-fns |
| Passwords | bcrypt |
| Auth | JWT (or equivalent session token) |

There is **no web frontend**. There are **no microservices**. Recommendation and renewal logic live on the **backend**, not in React Native screens.

## Repository layout

```
Library_Renewal/
  mobile/                 # Expo app (Phase 1)
  backend/                # Express + Prisma (Phase 2+)
  docs/                   # Architecture and product docs
  README.md
  .env.example
```

### Mobile (Phase 1)

```
mobile/
  app/                    # Expo Router routes
  src/
    theme/                # Design tokens
    components/           # Reusable UI
    data/                 # Seeded mock catalogue, loans, users
    domain/               # Types and display helpers (no API I/O)
    api/                  # Typed client (mock now, HTTP later)
    auth/                 # Session context (in-memory demo login in Phase 1)
```

### Backend (from Phase 2)

```
backend/
  src/
    routes/
    controllers/
    services/             # Auth, Book, Loan, Renewal, AlternativeResource, Action, Notification, Fine
    repositories/
    middleware/
    validators/
    prisma/
  tests/
```

## Request flow (target)

```
Expo screen
  → typed API client
    → REST endpoint
      → controller (HTTP only)
        → service (rules)
          → repository (Prisma)
            → PostgreSQL
```

Screens must not contain renewal eligibility, fine math, or ranking. Phase 1 puts **display helpers** (status labels, days remaining) in `src/domain` so they can be replaced by API payloads later.

## Auth and tenancy

- Students register and log in (demo credentials in seed data).
- Tokens are stored in SecureStore from Phase 2 onward. Phase 1 uses an in-memory session after demo login.
- Every loan, fine, academic need, and notification query is scoped to the authenticated user.

## Renewal (Phase 3)

A rule-based `RenewalService` evaluates **configurable** `LibraryPolicy` rows, not a single hardcoded policy. It returns a structured result:

```json
{
  "eligible": false,
  "reason_code": "ACTIVE_RESERVATION",
  "reason": "Another student has reserved this book.",
  "suggested_action": "FIND_ALTERNATIVE"
}
```

Renewals only mutate **this prototype database**. They never claim to change a real college ILS.

## Recommendations (Phase 4)

Hybrid ranking, all server-side. See [recommendation-engine.md](./recommendation-engine.md).

- Layer 1: metadata / topic overlap
- Layer 2: TF-IDF + cosine similarity
- Layer 3: optional embeddings (interface only until evaluated)

Availability is a **filter/label**, not a similarity weight. The original book is never recommended.

## Actions, reminders, fines (Phase 5)

Configurable urgency windows, preference modes (digest / important-only / normal / quiet), local notifications first, simulated fines only.

## Risks and compatibility notes

| Risk | Mitigation |
| --- | --- |
| Node 24 vs Expo support | Use current Expo SDK; if install fails, document using Node 20 LTS via nvm-windows |
| Windows + Expo Android | USB debugging + Expo Go; no EAS build required for Phase 1 |
| `lucide-react-native` extra native deps | Prefer icons that work with Expo Go |
| Mock vs real API drift | Keep types in `src/domain` shared conceptually with later Prisma models |
| Over-scoping Phase 1 | No Express, Prisma, PostgreSQL, or ranking implementation yet |
| Embedding models | Deferred; module boundary documented, not installed |

## What Phase 1 does **not** do

- PostgreSQL, Prisma, Express, JWT, bcrypt
- Real renewal transactions
- TF-IDF / embeddings
- Push notifications
- Payments
