# Recommendation engine

> **Status (Nov 2026):** the backend runs on PostgreSQL via Prisma (`backend/prisma/migrations`), the mobile app uses it in API mode with SecureStore sessions, and the in-memory store is only for tests/offline demos. Where this planning document disagrees with the code, the code and the READMEs are authoritative.

LibTrack’s differentiator is **explainable, need-aware alternative resources** when a student still needs a title they cannot renew or borrow.

This module is **backend-only**. Phase 1 only shows **mocked** alternatives so the UI and “Still need this book?” flow can be exercised.

## Goal

Given a source book (and optional academic needs), return ranked alternatives that:

1. Cover overlapping topics / courses
2. Match academic level when possible
3. Exclude the source book
4. Never present unavailable physical copies as currently accessible
5. Include digital items only when a valid resource record/link exists
6. Attach a human-readable explanation

No LLM is used to generate rankings.

## Hybrid layers

### Layer 1 — Structured metadata (Phase 4, first)

Inputs: topic tags, course tags, category, academic level.

Scoring sketch:

- Normalize tokens (lowercase, strip punctuation, synonym map from config)
- Topic overlap: Jaccard similarity on topic sets
- Course overlap: intersection of course codes/tags
- Academic level: exact match, adjacent year, or mismatch penalty

### Layer 2 — TF-IDF + cosine similarity (Phase 4, after metadata)

Corpus: title, description, topic labels, course labels, plus the student’s optional academic-need text.

Compare query vector (source book + needs) to candidate catalogue vectors. Do **not** train a custom model; use a deterministic TF-IDF implementation in the backend.

### Layer 3 — Optional embeddings (later, optional)

`EmbeddingProvider` interface:

- `embed(text: string): Promise<number[]>`
- Swap in a pretrained model (or hosted API) without changing ranking orchestration

**Not implemented initially.** No training from scratch. No labelled dataset required to ship Layers 1–2.

## Initial scoring weights (configurable)

These are **starting values** to evaluate, not proven optima:

| Signal | Weight |
| --- | --- |
| Metadata / topic similarity | 40% |
| TF-IDF similarity | 35% |
| Course relevance | 15% |
| Academic-level compatibility | 10% |

```
score = 0.40 * metadata + 0.35 * tfidf + 0.15 * course + 0.10 * level
```

**Availability is not part of this sum.** After ranking, the service:

- Drops or flags physical copies with zero available copies
- Labels digital items only if `digitalUrl` / resource record is present
- Returns `availability` separately from `score`

## Explanations

Each hit includes structured reasons, for example:

- Covers Database Normalisation
- Covers SQL
- Relevant to Database Management Systems
- One physical copy is available

UI must render these strings from the API, not invent them on the client.

## Evaluation (Phase 6 scripts)

Compare:

- Metadata-only
- Metadata + TF-IDF
- Metadata + TF-IDF + embeddings (if introduced)

Metrics:

- Precision@5
- Recall@5
- NDCG@5
- Recommendation latency
- Availability-aware recommendation rate (share of top-k that are actually accessible)

A small **manually judged** evaluation set will live under `backend/eval/` in a later phase. **Do not invent metric numbers.**

## Persistence

- `Recommendation` — snapshot of a ranked list for a user + source book + optional needs
- `RecommendationFeedback` — useful / not useful / selected alternative

## Limitations (honest)

- Jaccard + TF-IDF will miss synonyms unless a synonym map is maintained
- Catalogue size in the prototype is ~25 titles; ranking quality will not generalise to a real ILS
- Academic needs are optional; ranking without them is topic/course only
- Embeddings may not be worth the latency/ops cost; evaluate before adding
