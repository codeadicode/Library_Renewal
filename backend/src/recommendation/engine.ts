import {
  Book,
  Topic,
  Course,
  AcademicNeed,
  AlternativeRecommendation,
  LibraryPolicy,
} from '../types';
import { TfIdf } from './tfidf';
import { computeMetadataSimilarity } from './metadataMatcher';
import { EmbeddingProvider, RecommendationScoringWeights } from './types';
import { now } from '../lib/clock';

export class RecommendationEngine {
  private tfidf: TfIdf;
  private embeddingProvider?: EmbeddingProvider;

  constructor(embeddingProvider?: EmbeddingProvider) {
    this.tfidf = new TfIdf();
    this.embeddingProvider = embeddingProvider;
  }

  public indexCatalogue(books: Book[], topicLookup: Map<string, Topic>, courseLookup: Map<string, Course>): void {
    this.tfidf = new TfIdf();
    for (const b of books) {
      const topicText = b.topicIds.map((id) => topicLookup.get(id)?.name || '').join(' ');
      const courseText = b.courseIds.map((id) => courseLookup.get(id)?.name || '').join(' ');
      const corpus = `${b.title} ${b.author} ${b.category} ${b.description} ${topicText} ${courseText}`;
      this.tfidf.addDocument(b.id, corpus);
    }
  }

  public rankAlternatives(params: {
    sourceBook: Book;
    candidates: Book[];
    academicNeeds: AcademicNeed[];
    topicLookup: Map<string, Topic>;
    courseLookup: Map<string, Course>;
    availablePhysicalCounts: Map<string, number>;
    policy: LibraryPolicy;
    weights?: Partial<RecommendationScoringWeights>;
    /** Reference time for assessment urgency. Defaults to the app clock. */
    at?: Date;
  }): AlternativeRecommendation[] {
    const {
      sourceBook,
      candidates,
      academicNeeds,
      topicLookup,
      courseLookup,
      availablePhysicalCounts,
      policy,
    } = params;
    const at = params.at ?? now();

    const weights: RecommendationScoringWeights = {
      metadata: params.weights?.metadata ?? policy.weightMetadata,
      tfidf: params.weights?.tfidf ?? policy.weightTfidf,
      course: params.weights?.course ?? policy.weightCourse,
      level: params.weights?.level ?? policy.weightLevel,
    };

    // Build source book query text including optional student needs
    const sourceTopicText = sourceBook.topicIds
      .map((id) => topicLookup.get(id)?.name || '')
      .join(' ');
    const needsText = academicNeeds.map((n) => `${n.course} ${n.topic}`).join(' ');
    const sourceQuery = `${sourceBook.title} ${sourceBook.description} ${sourceTopicText} ${needsText}`;
    const sourceVector = this.tfidf.computeVector(sourceQuery);

    const scoredList: AlternativeRecommendation[] = [];

    for (const candidate of candidates) {
      // RULE 1: Never recommend the original book as an alternative
      if (candidate.id === sourceBook.id) continue;

      // Layer 1: Structured metadata matching
      const meta = computeMetadataSimilarity(
        sourceBook,
        candidate,
        academicNeeds,
        topicLookup,
        courseLookup,
        at,
      );

      // Layer 2: TF-IDF and cosine similarity
      const candidateTopicText = candidate.topicIds
        .map((id) => topicLookup.get(id)?.name || '')
        .join(' ');
      const candidateText = `${candidate.title} ${candidate.description} ${candidateTopicText}`;
      const candidateVector = this.tfidf.computeVector(candidateText);
      const tfidfScore = TfIdf.cosineSimilarity(sourceVector, candidateVector);

      // Total similarity score before availability
      const totalScore =
        weights.metadata * meta.metadataScore +
        weights.tfidf * tfidfScore +
        weights.course * meta.courseScore +
        weights.level * meta.levelScore;

      // Only consider if there is at least minimal relevance
      if (totalScore < 0.1) continue;

      // Alternative learning resource must have subject, topic, course or strong semantic relevance
      const hasTopicOverlap = meta.matchingTopics.length > 0;
      const hasCourseOverlap = meta.courseScore > 0;
      const hasNeedBoost = meta.needBoost > 0;
      const hasStrongText = tfidfScore >= 0.15;
      if (!hasTopicOverlap && !hasCourseOverlap && !hasNeedBoost && !hasStrongText) {
        continue;
      }

      // RULE 2: Availability checked separately from similarity scoring
      const availablePhysical = availablePhysicalCounts.get(candidate.id) || 0;
      const digitalAccessible = Boolean(candidate.digitalUrl && candidate.digitalUrl.startsWith('http'));

      const finalReasons = [...meta.reasons];
      if (availablePhysical > 0) {
        finalReasons.push(
          `${availablePhysical} physical cop${availablePhysical === 1 ? 'y is' : 'ies are'} available.`,
        );
      } else if (digitalAccessible) {
        finalReasons.push('No physical copy is free; valid digital learning resource available.');
      } else {
        finalReasons.push('No currently accessible copy; included for reference only.');
      }

      scoredList.push({
        book: candidate,
        score: parseFloat(totalScore.toFixed(4)),
        metadata_score: parseFloat(meta.metadataScore.toFixed(4)),
        tfidf_score: parseFloat(tfidfScore.toFixed(4)),
        course_score: parseFloat(meta.courseScore.toFixed(4)),
        level_score: parseFloat(meta.levelScore.toFixed(4)),
        matching_topics: meta.matchingTopics,
        reasons: finalReasons,
        available_physical: availablePhysical,
        digital_accessible: digitalAccessible,
        format: candidate.resourceType,
      });
    }

    // Sort prioritising accessible copies first, then descending by score
    scoredList.sort((a, b) => {
      const accessA = a.available_physical > 0 || a.digital_accessible ? 1 : 0;
      const accessB = b.available_physical > 0 || b.digital_accessible ? 1 : 0;
      if (accessA !== accessB) return accessB - accessA;
      return b.score - a.score;
    });

    return scoredList.slice(0, 10);
  }
}

