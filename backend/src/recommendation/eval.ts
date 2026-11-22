import { Book, Topic, Course, AcademicNeed, LibraryPolicy } from '../types';
import { RecommendationEngine } from './engine';

export interface EvalQuery {
  sourceBookId: string;
  relevantBookIds: string[]; // Ground truth manually judged relevant book IDs
  needs?: AcademicNeed[];
}

export interface EvalMetrics {
  precisionAt5: number;
  recallAt5: number;
  ndcgAt5: number;
  averageLatencyMs: number;
  availabilityAwareRate: number;
}

export class RecommendationEvaluator {
  private engine: RecommendationEngine;

  constructor(engine: RecommendationEngine) {
    this.engine = engine;
  }

  private computeDCG(retrieved: string[], relevant: Set<string>, k: number): number {
    let dcg = 0;
    for (let i = 0; i < Math.min(retrieved.length, k); i++) {
      const rel = relevant.has(retrieved[i]) ? 1 : 0;
      dcg += rel / Math.log2(i + 2); // i=0 -> log2(2) = 1
    }
    return dcg;
  }

  private computeIDCG(totalRelevant: number, k: number): number {
    let idcg = 0;
    const limit = Math.min(totalRelevant, k);
    for (let i = 0; i < limit; i++) {
      idcg += 1 / Math.log2(i + 2);
    }
    return idcg === 0 ? 1 : idcg;
  }

  public evaluate(params: {
    queries: EvalQuery[];
    books: Book[];
    topicLookup: Map<string, Topic>;
    courseLookup: Map<string, Course>;
    availableCounts: Map<string, number>;
    policy: LibraryPolicy;
    weights?: { metadata: number; tfidf: number; course: number; level: number };
  }): EvalMetrics {
    const { queries, books, topicLookup, courseLookup, availableCounts, policy, weights } = params;
    this.engine.indexCatalogue(books, topicLookup, courseLookup);

    let totalP5 = 0;
    let totalR5 = 0;
    let totalNDCG5 = 0;
    let totalLatency = 0;
    let totalAccessibleTopK = 0;
    let totalEvaluatedRecommendations = 0;

    for (const q of queries) {
      const sourceBook = books.find((b) => b.id === q.sourceBookId);
      if (!sourceBook) continue;

      const startTime = performance.now();
      const recs = this.engine.rankAlternatives({
        sourceBook,
        candidates: books,
        academicNeeds: q.needs || [],
        topicLookup,
        courseLookup,
        availablePhysicalCounts: availableCounts,
        policy,
        weights,
      });
      const latency = performance.now() - startTime;
      totalLatency += latency;

      const top5 = recs.slice(0, 5);
      const top5Ids = top5.map((r) => r.book.id);
      const relevantSet = new Set(q.relevantBookIds);

      // Precision@5
      const hits = top5Ids.filter((id) => relevantSet.has(id)).length;
      const p5 = top5Ids.length > 0 ? hits / top5Ids.length : 0;
      totalP5 += p5;

      // Recall@5
      const r5 = relevantSet.size > 0 ? hits / relevantSet.size : 0;
      totalR5 += r5;

      // NDCG@5
      const dcg = this.computeDCG(top5Ids, relevantSet, 5);
      const idcg = this.computeIDCG(relevantSet.size, 5);
      totalNDCG5 += dcg / idcg;

      // Availability-aware rate: share of top-5 that are actually accessible (physical > 0 or digital)
      for (const rec of top5) {
        totalEvaluatedRecommendations++;
        if (rec.available_physical > 0 || rec.digital_accessible) {
          totalAccessibleTopK++;
        }
      }
    }

    const count = Math.max(1, queries.length);
    return {
      precisionAt5: parseFloat((totalP5 / count).toFixed(4)),
      recallAt5: parseFloat((totalR5 / count).toFixed(4)),
      ndcgAt5: parseFloat((totalNDCG5 / count).toFixed(4)),
      averageLatencyMs: parseFloat((totalLatency / count).toFixed(2)),
      availabilityAwareRate:
        totalEvaluatedRecommendations > 0
          ? parseFloat((totalAccessibleTopK / totalEvaluatedRecommendations).toFixed(4))
          : 0,
    };
  }
}

