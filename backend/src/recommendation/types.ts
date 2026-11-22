export interface EmbeddingProvider {
  name: string;
  dimension: number;
  embed(text: string): Promise<number[]>;
}

export interface RecommendationScoringWeights {
  metadata: number;
  tfidf: number;
  course: number;
  level: number;
}

export interface CandidateScores {
  bookId: string;
  metadataScore: number;
  tfidfScore: number;
  courseScore: number;
  levelScore: number;
  totalScore: number;
  matchingTopics: string[];
  reasons: string[];
}

