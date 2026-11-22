import { differenceInCalendarDays } from 'date-fns';
import { Book, Topic, Course, AcademicNeed } from '../types';
import { needUrgencyWeight } from '../services/academicPlanning';

export function jaccardSimilarity(setA: string[], setB: string[]): number {
  const a = new Set(setA);
  const b = new Set(setB);
  if (a.size === 0 && b.size === 0) return 0;
  const intersection = [...a].filter((item) => b.has(item)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

export function computeMetadataSimilarity(
  source: Book,
  candidate: Book,
  academicNeeds: AcademicNeed[],
  topicLookup: Map<string, Topic>,
  courseLookup: Map<string, Course>,
  at: Date = new Date(),
): {
  metadataScore: number;
  needBoost: number;
  courseScore: number;
  levelScore: number;
  matchingTopics: string[];
  reasons: string[];
} {
  const topicOverlap = jaccardSimilarity(source.topicIds, candidate.topicIds);
  const courseOverlap = jaccardSimilarity(source.courseIds, candidate.courseIds);
  const levelScore = source.academicLevel === candidate.academicLevel ? 1.0 : 0.4;

  // Boost if the candidate covers one of the student's active academic needs.
  // The boost scales with how soon the assessment is (see needUrgencyWeight),
  // so an exam next week matters more than a project next semester.
  const candidateTopicNames = candidate.topicIds
    .map((id) => topicLookup.get(id)?.name.toLowerCase() || '')
    .filter(Boolean);

  let strongestNeed: { need: AcademicNeed; weight: number } | null = null;
  for (const need of academicNeeds) {
    const needTopic = need.topic.toLowerCase();
    const matches = candidateTopicNames.some((name) => needTopic.includes(name) || name.includes(needTopic));
    if (!matches) continue;
    const weight = needUrgencyWeight(need, at);
    if (weight > 0 && (!strongestNeed || weight > strongestNeed.weight)) strongestNeed = { need, weight };
  }
  const needBoost = strongestNeed ? 0.2 * strongestNeed.weight : 0;
  const metadataScore = Math.min(1.0, topicOverlap * 0.8 + needBoost);

  const matchingTopics = candidate.topicIds
    .filter((id) => source.topicIds.includes(id))
    .map((id) => topicLookup.get(id)?.name || id);

  const reasons: string[] = [];
  matchingTopics.forEach((t) => reasons.push(`Covers ${t}.`));

  source.courseIds
    .filter((id) => candidate.courseIds.includes(id))
    .forEach((id) => {
      const c = courseLookup.get(id);
      reasons.push(`Relevant to ${c ? `${c.code} ${c.name}` : id}.`);
    });

  if (source.academicLevel === candidate.academicLevel) {
    reasons.push(`Matches academic level (${candidate.academicLevel}).`);
  }

  if (strongestNeed) {
    const { need } = strongestNeed;
    const days = differenceInCalendarDays(new Date(need.assessmentDate), at);
    const when = days < 0 ? 'already held' : days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`;
    reasons.push(`Covers ${need.topic} for your ${need.assessmentType.toLowerCase()} (${when}).`);
  }

  return {
    metadataScore,
    needBoost,
    courseScore: courseOverlap,
    levelScore,
    matchingTopics,
    reasons,
  };
}

