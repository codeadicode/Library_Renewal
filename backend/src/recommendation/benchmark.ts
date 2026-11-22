import { Repositories } from '../repositories/interfaces';
import { Course, Topic } from '../types';
import { RecommendationEngine } from './engine';
import { EvalMetrics, EvalQuery, RecommendationEvaluator } from './eval';
import { RecommendationScoringWeights } from './types';

/**
 * Manually judged relevance set. Used by BOTH `npm run eval` and
 * GET /api/eval/recommendations so the two can never report different numbers.
 */
export const BENCHMARK_QUERIES: EvalQuery[] = [
  { sourceBookId: 'b-dsc', relevantBookIds: ['b-elmasri', 'b-ramakrishnan', 'b-han'] },
  { sourceBookId: 'b-oscon', relevantBookIds: ['b-mos', 'b-tan-os', 'b-kr'] },
  { sourceBookId: 'b-cn', relevantBookIds: ['b-kurose', 'b-stallings'] },
  { sourceBookId: 'b-clrs', relevantBookIds: ['b-sedge', 'b-rosen'] },
  { sourceBookId: 'b-proakis', relevantBookIds: ['b-opp-ss', 'b-lathi', 'b-haykin'] },
  { sourceBookId: 'b-sedra', relevantBookIds: ['b-razavi', 'b-weste'] },
];

export const BENCHMARK_CONFIGS: Record<'metadataOnly' | 'hybrid', RecommendationScoringWeights> = {
  metadataOnly: { metadata: 0.85, tfidf: 0.0, course: 0.1, level: 0.05 },
  hybrid: { metadata: 0.4, tfidf: 0.35, course: 0.15, level: 0.1 },
};

type QualityMetric = 'precisionAt5' | 'recallAt5' | 'ndcgAt5' | 'availabilityAwareRate';

const METRIC_LABELS: Record<QualityMetric, string> = {
  precisionAt5: 'Precision@5',
  recallAt5: 'Recall@5',
  ndcgAt5: 'NDCG@5',
  availabilityAwareRate: 'Availability-aware rate',
};

export interface MetricComparison {
  metric: QualityMetric;
  label: string;
  metadataOnly: number;
  hybrid: number;
  delta: number;
  winner: 'hybrid' | 'metadataOnly' | 'tie';
}

export interface BenchmarkReport {
  queryCount: number;
  k: number;
  metadataOnly: EvalMetrics;
  hybridTfIdf: EvalMetrics;
  comparison: MetricComparison[];
  /** Data-driven verdict. Never hard-coded. */
  conclusion: string;
  /** @deprecated use `conclusion` */
  summary: string;
}

const EPSILON = 0.0005;

export function compareMetrics(meta: EvalMetrics, hybrid: EvalMetrics): MetricComparison[] {
  return (Object.keys(METRIC_LABELS) as QualityMetric[]).map((metric) => {
    const delta = parseFloat((hybrid[metric] - meta[metric]).toFixed(4));
    return {
      metric,
      label: METRIC_LABELS[metric],
      metadataOnly: meta[metric],
      hybrid: hybrid[metric],
      delta,
      winner: Math.abs(delta) < EPSILON ? 'tie' : delta > 0 ? 'hybrid' : 'metadataOnly',
    };
  });
}

const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(4)}`;

/** Writes the conclusion from the measured numbers, including where the hybrid loses. */
export function writeConclusion(comparison: MetricComparison[], queryCount: number, meta: EvalMetrics, hybrid: EvalMetrics): string {
  const better = comparison.filter((c) => c.winner === 'hybrid');
  const worse = comparison.filter((c) => c.winner === 'metadataOnly');
  const ndcg = comparison.find((c) => c.metric === 'ndcgAt5')!;

  const parts: string[] = [];
  if (better.length) parts.push(`Hybrid improves ${better.map((c) => `${c.label} (${signed(c.delta)})`).join(', ')}`);
  if (worse.length) parts.push(`it is worse on ${worse.map((c) => `${c.label} (${signed(c.delta)})`).join(', ')}`);
  if (!better.length && !worse.length) parts.push('Both configurations score the same on every quality metric');

  const verdict =
    ndcg.winner === 'hybrid'
      ? 'On ranking quality (NDCG@5) the hybrid configuration is the better default for this benchmark.'
      : ndcg.winner === 'metadataOnly'
        ? 'On ranking quality (NDCG@5) metadata-only ranks better, so this benchmark does not support the hybrid default.'
        : 'NDCG@5 is tied, so this benchmark does not distinguish the two configurations.';

  const latency = `Mean latency per query: metadata-only ${meta.averageLatencyMs.toFixed(2)} ms, hybrid ${hybrid.averageLatencyMs.toFixed(2)} ms (small, noisy timings; not a basis for comparison).`;
  const caveat = `Based on ${queryCount} manually judged queries; differences this small are indicative, not statistically significant.`;

  return `${parts.join('; ')}. ${verdict} ${latency} ${caveat}`;
}

export async function runRecommendationBenchmark(repos: Repositories, at?: Date): Promise<BenchmarkReport> {
  const [books, topics, courses, availableCounts, policy] = await Promise.all([
    repos.books.findAll(),
    repos.books.findTopics(),
    repos.books.findCourses(),
    repos.books.countAllAvailablePhysical(),
    repos.policy.getDefaultPolicy(),
  ]);
  const topicLookup = new Map<string, Topic>(topics.map((t) => [t.id, t]));
  const courseLookup = new Map<string, Course>(courses.map((c) => [c.id, c]));

  const known = new Set(books.map((b) => b.id));
  const queries = BENCHMARK_QUERIES.filter((q) => known.has(q.sourceBookId));

  const evaluator = new RecommendationEvaluator(new RecommendationEngine());
  const common = { queries, books, topicLookup, courseLookup, availableCounts, policy, at };
  const metadataOnly = evaluator.evaluate({ ...common, weights: BENCHMARK_CONFIGS.metadataOnly });
  const hybridTfIdf = evaluator.evaluate({ ...common, weights: BENCHMARK_CONFIGS.hybrid });

  const comparison = compareMetrics(metadataOnly, hybridTfIdf);
  const conclusion = writeConclusion(comparison, queries.length, metadataOnly, hybridTfIdf);
  return { queryCount: queries.length, k: 5, metadataOnly, hybridTfIdf, comparison, conclusion, summary: conclusion };
}
