import { RecommendationEngine } from '../recommendation/engine';
import {
  IAcademicNeedRepository,
  IBookRepository,
  IPolicyRepository,
} from '../repositories/interfaces';
import { AlternativeRecommendation, Book, Course, Topic } from '../types';

export class AlternativeResourceService {
  private engine: RecommendationEngine;

  constructor(
    private bookRepo: IBookRepository,
    private academicNeedRepo: IAcademicNeedRepository,
    private policyRepo: IPolicyRepository,
  ) {
    this.engine = new RecommendationEngine();
  }

  public async findAlternativesForBook(
    bookId: string,
    authenticatedUserId: string,
  ): Promise<{
    sourceBook: Book;
    recommendations: AlternativeRecommendation[];
  }> {
    const sourceBook = await this.bookRepo.findById(bookId);
    if (!sourceBook) {
      const err = new Error('Source book not found');
      (err as any).statusCode = 404;
      throw err;
    }

    const [allBooks, allTopics, allCourses, academicNeeds, availableCounts, policy] =
      await Promise.all([
        this.bookRepo.findAll(),
        this.bookRepo.findTopics(),
        this.bookRepo.findCourses(),
        this.academicNeedRepo.findByUserId(authenticatedUserId),
        this.bookRepo.countAllAvailablePhysical(),
        this.policyRepo.getDefaultPolicy(),
      ]);

    const topicLookup = new Map<string, Topic>();
    allTopics.forEach((t) => topicLookup.set(t.id, t));

    const courseLookup = new Map<string, Course>();
    allCourses.forEach((c) => courseLookup.set(c.id, c));

    // Index catalogue and rank alternatives
    this.engine.indexCatalogue(allBooks, topicLookup, courseLookup);
    const recommendations = this.engine.rankAlternatives({
      sourceBook,
      candidates: allBooks,
      academicNeeds,
      topicLookup,
      courseLookup,
      availablePhysicalCounts: availableCounts,
      policy,
    });

    return {
      sourceBook,
      recommendations,
    };
  }
}

