# Database design

PostgreSQL + Prisma. Implemented in **Phase 2**. This document is the target schema so mobile mock types stay aligned.

LibTrack stores **simulated** catalogue, loans, and fines. Demo rows should be labelled as simulated in the product UI.

## Entities

| Model | Role |
| --- | --- |
| User | Student account (studentId, name, email, passwordHash, course, academicYear, restriction flags, notification prefs) |
| Course | Course/subject catalogue |
| Topic | Canonical topic vocabulary |
| Book | Title-level bibliographic record |
| BookCopy | Physical copy of a book |
| BookTopic | Book ↔ Topic |
| BookCourse | Book ↔ Course (optional join) |
| Loan | Borrowing of a **specific copy** |
| Reservation | Hold on a title or copy |
| RenewalAttempt | Success/failure audit for a loan |
| AcademicNeed | Optional student planner row |
| Recommendation | Ranked alternative snapshot |
| RecommendationFeedback | User judgement on a recommendation |
| Notification | In-app / scheduled reminder records |
| FineLedger | Simulated fine events |
| LibraryPolicy | Configurable renewal, loan length, reminder, fine, scoring weights |

## Cardinality

- One `Book` has many `BookCopy`
- One `User` has many `Loan` (active and historical)
- A `Loan` **must** reference one `BookCopy` (not denormalised book fields)
- A `Book` has many `Topic` via `BookTopic`
- A `User` has many `AcademicNeed`
- A `Book` has many `Reservation`
- A `Loan` has many `RenewalAttempt`

## Indexing (planned)

- Unique: `User.email`, `User.studentId`, `Book.isbn` (where present)
- `Loan(userId, status)`, `Loan(copyId)`, `Loan(dueDate)`
- `BookCopy(bookId, status)`
- `Reservation(bookId, status)`
- `Notification(userId, readAt)`
- `BookTopic(topicId)`, `BookTopic(bookId)`

Timestamps on all tables (`createdAt`, `updatedAt`). Soft constraints via Prisma + Zod.

## Policy, not hardcoding

`LibraryPolicy` holds:

- `maxRenewals`
- `loanPeriodDays`
- `renewalPeriodDays`
- `itemRenewableDefault`
- reminder thresholds (upcoming / approaching / urgent)
- fine per overdue day
- recommendation weights

Multiple demo policies may exist (e.g. standard vs restricted).

## Security

- `passwordHash` only; never plaintext
- No real student PII in seeds
- Secrets in environment variables (`DATABASE_URL`, `JWT_SECRET`)

## Phase 1 mapping

Mobile mock types in `mobile/src/domain` mirror these entities enough for screens. They are **not** a database.
