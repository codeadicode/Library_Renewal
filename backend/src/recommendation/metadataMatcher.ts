import { Book, Topic, Course, AcademicNeed } from '../types';

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
): {
  metadataScore: number;
  courseScore: number;
  levelScore: number;
  matchingTopics: string[];
  reasons: string[];
} {
  const topicOverlap = jaccardSimilarity(source.topicIds, candidate.topicIds);
  const courseOverlap = jaccardSimilarity(source.courseIds, candidate.courseIds);
  const levelScore = source.academicLevel === candidate.academicLevel ? 1.0 : 0.4;

  // Boost if candidate matches student's explicit academic needs
  const needTopics = academicNeeds.map((n) => n.topic.toLowerCase());
  const candidateTopicNames = candidate.topicIds
    .map((id) => topicLookup.get(id)?.name.toLowerCase() || '')
    .filter(Boolean);

  const hasNeedBoost = candidateTopicNames.some((name) =>
    needTopics.some((need) => need.includes(name) || name.includes(need)),
  );
  const needBoost = hasNeedBoost ? 0.2 : 0.0;
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

  if (hasNeedBoost) {
    reasons.push(`Matches your active academic requirement.`);
  }

  return {
    metadataScore,
    courseScore: courseOverlap,
    levelScore,
    matchingTopics,
    reasons,
  };
}

