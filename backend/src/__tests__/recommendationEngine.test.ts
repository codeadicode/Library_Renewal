import { RecommendationEngine } from '../recommendation/engine';
import { RecommendationEvaluator } from '../recommendation/eval';
import { MemoryStore } from '../repositories/memoryStore';

describe('Alternative Resource Recommendation Engine', () => {
  let store: MemoryStore;
  let engine: RecommendationEngine;

  beforeEach(() => {
    store = new MemoryStore();
    engine = new RecommendationEngine();
  });

  test('Never recommends source book as an alternative', () => {
    const allBooks = Array.from(store.books.values());
    const sourceBook = store.books.get('b-dsc')!;
    const availableCounts = new Map<string, number>();
    allBooks.forEach((b) => availableCounts.set(b.id, 1));

    engine.indexCatalogue(allBooks, store.topics, store.courses);
    const recs = engine.rankAlternatives({
      sourceBook,
      candidates: allBooks,
      academicNeeds: [],
      topicLookup: store.topics,
      courseLookup: store.courses,
      availablePhysicalCounts: availableCounts,
      policy: store.policy,
    });

    const containsSource = recs.some((r) => r.book.id === sourceBook.id);
    expect(containsSource).toBe(false);
  });

  test('Ranks highly relevant books on top with explainable reasons', () => {
    const allBooks = Array.from(store.books.values());
    const sourceBook = store.books.get('b-dsc')!; // Database System Concepts
    const availableCounts = new Map<string, number>();
    allBooks.forEach((b) => availableCounts.set(b.id, 1));

    engine.indexCatalogue(allBooks, store.topics, store.courses);
    const recs = engine.rankAlternatives({
      sourceBook,
      candidates: allBooks,
      academicNeeds: [],
      topicLookup: store.topics,
      courseLookup: store.courses,
      availablePhysicalCounts: availableCounts,
      policy: store.policy,
    });

    expect(recs.length).toBeGreaterThan(0);
    // Fundamentals of Database Systems or Ramakrishnan DBMS should be top candidates
    const topBook = recs[0];
    expect(topBook.book.category).toBe('Databases');
    expect(topBook.matching_topics.length).toBeGreaterThan(0);
    expect(topBook.reasons.length).toBeGreaterThan(0);
    expect(topBook.reasons.some((r) => r.includes('Covers'))).toBe(true);
  });

  test('Boosts recommendations matching explicit student academic needs', () => {
    const allBooks = Array.from(store.books.values());
    const sourceBook = store.books.get('b-dsc')!;
    const availableCounts = new Map<string, number>();
    allBooks.forEach((b) => availableCounts.set(b.id, 1));

    const needs = [
      {
        id: 'need-1',
        userId: 'u-akash',
        course: 'Database Management Systems',
        topic: 'Database Normalisation',
        assessmentType: 'INTERNAL' as const,
        assessmentDate: new Date('2026-11-28'),
        neededUntil: new Date('2026-11-28'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    engine.indexCatalogue(allBooks, store.topics, store.courses);
    const recsWithNeed = engine.rankAlternatives({
      sourceBook,
      candidates: allBooks,
      academicNeeds: needs,
      topicLookup: store.topics,
      courseLookup: store.courses,
      availablePhysicalCounts: availableCounts,
      policy: store.policy,
    });

    const elmasri = recsWithNeed.find((r) => r.book.id === 'b-elmasri');
    expect(elmasri).toBeDefined();
    expect(elmasri!.reasons.some((r) => r.includes('academic requirement'))).toBe(true);
  });

  test('Separately checks physical availability and prioritises accessible copies', () => {
    const allBooks = Array.from(store.books.values());
    const sourceBook = store.books.get('b-dsc')!;
    const availableCounts = new Map<string, number>();

    // Give b-elmasri 1 available copy, b-ramakrishnan 0 copies
    availableCounts.set('b-elmasri', 1);
    availableCounts.set('b-ramakrishnan', 0);

    engine.indexCatalogue(allBooks, store.topics, store.courses);
    const recs = engine.rankAlternatives({
      sourceBook,
      candidates: allBooks,
      academicNeeds: [],
      topicLookup: store.topics,
      courseLookup: store.courses,
      availablePhysicalCounts: availableCounts,
      policy: store.policy,
    });

    const elmasri = recs.find((r) => r.book.id === 'b-elmasri')!;
    const ramakrishnan = recs.find((r) => r.book.id === 'b-ramakrishnan')!;

    expect(elmasri.available_physical).toBe(1);
    expect(ramakrishnan.available_physical).toBe(0);
    // Physically accessible book should appear before unavailable book
    const elmasriIndex = recs.indexOf(elmasri);
    const ramaIndex = recs.indexOf(ramakrishnan);
    expect(elmasriIndex).toBeLessThan(ramaIndex);
  });

  test('Recommends core ECE and common Math books for ECE students with no CSE books', () => {
    const allBooks = Array.from(store.books.values());
    const sourceBook = store.books.get('b-proakis')!; // Digital Signal Processing (ECE)
    const availableCounts = new Map<string, number>();
    allBooks.forEach((b) => availableCounts.set(b.id, 1));

    engine.indexCatalogue(allBooks, store.topics, store.courses);
    const recs = engine.rankAlternatives({
      sourceBook,
      candidates: allBooks,
      academicNeeds: [],
      topicLookup: store.topics,
      courseLookup: store.courses,
      availablePhysicalCounts: availableCounts,
      policy: store.policy,
    });

    expect(recs.length).toBeGreaterThan(0);
    // Top recommendations must be ECE or common Math books
    const topRecs = recs.slice(0, 3);
    const topCategories = topRecs.map((r) => r.book.category);
    expect(topCategories.every((cat) => ['Electronics', 'Communications', 'Mathematics'].includes(cat))).toBe(true);

    // Must NOT recommend unrelated CSE databases or compilers
    const containsCompilers = recs.some((r) => r.book.id === 'b-dragon');
    const containsDatabase = recs.some((r) => r.book.id === 'b-dsc');
    expect(containsCompilers).toBe(false);
    expect(containsDatabase).toBe(false);
  });

  test('Runs recommendation evaluation benchmark computing Precision@5, NDCG@5, and latency', () => {
    const allBooks = Array.from(store.books.values());
    const availableCounts = new Map<string, number>();
    allBooks.forEach((b) => availableCounts.set(b.id, 1));

    const queries = [
      {
        sourceBookId: 'b-dsc',
        relevantBookIds: ['b-elmasri', 'b-ramakrishnan'],
      },
      {
        sourceBookId: 'b-oscon',
        relevantBookIds: ['b-mos', 'b-tan-os'],
      },
    ];

    const evaluator = new RecommendationEvaluator(engine);
    const metrics = evaluator.evaluate({
      queries,
      books: allBooks,
      topicLookup: store.topics,
      courseLookup: store.courses,
      availableCounts,
      policy: store.policy,
    });

    expect(metrics.precisionAt5).toBeGreaterThan(0);
    expect(metrics.ndcgAt5).toBeGreaterThan(0);
    expect(metrics.averageLatencyMs).toBeLessThan(100);
    expect(metrics.availabilityAwareRate).toBeGreaterThanOrEqual(0);
  });
});

