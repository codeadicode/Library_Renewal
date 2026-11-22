# Implementation roadmap

Work incrementally. Do not implement the whole product in one pass.

## Phase 1 — Mobile foundation (this milestone)

- Expo + TypeScript + Expo Router
- Design tokens and reusable components
- Bottom tabs: Home, My Books, Discover, Profile
- Auth screens (demo login against mock students)
- Book details, still-need workflow UI, mocked alternatives
- Typed mock API client + TanStack Query
- README and architecture docs

**Out of scope:** Express, Prisma, PostgreSQL, real JWT, TF-IDF, notifications scheduling, fine engine.

## Phase 2 — Backend foundation

- Express + Prisma + PostgreSQL
- Schema + seed (5 students, ~25 books, copies, loans, reservations, fines)
- Auth: register, login, `/me`
- Book search and loan list APIs
- Ownership checks

## Phase 3 — Renewal engine

- Configurable policy evaluation
- Structured eligibility + reason codes
- Confirm-then-renew transactions
- Wire mobile client from mock to HTTP

## Phase 4 — Resource continuity

- Metadata matching
- TF-IDF + cosine
- Explanations + availability labels
- Academic needs as optional ranking input
- Embedding **interface only**

## Phase 5 — Action engine

- Configurable urgency
- Local notifications + preferences
- Fine calculation (simulated, labelled as demo)
- Duplicate reminder prevention

## Phase 6 — Testing and refinement

- Unit tests: eligibility, dues, fines, ranking, auth ownership, reminder de-dupe
- Eval scripts: P@5, R@5, NDCG@5, latency, availability-aware rate
- Empty / loading / error states
- Android device pass

## Phase 7 — Optional embeddings

Only if Phase 6 eval shows TF-IDF is insufficient **and** latency is acceptable.
