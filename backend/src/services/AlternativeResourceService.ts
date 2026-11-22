import { RecommendationEngine } from '../recommendation/engine';
import { DataStore } from '../repositories/interfaces';
import { AlternativeRecommendation, Book, Course, Topic } from '../types';
import { now } from '../lib/clock';
import { notFound } from '../lib/errors';
import { isActiveNeed } from './academicPlanning';

export class AlternativeResourceService {
  private engine = new RecommendationEngine();

  constructor(private store: DataStore) {}

  public async findAlternativesForBook(
    bookId: string,
    authenticatedUserId: string,
  ): Promise<{ sourceBook: Book; recommendations: AlternativeRecommendation[] }> {
    const { repos } = this.store;
    const sourceBook = await repos.books.findById(bookId);
    if (!sourceBook) throw notFound('Source book not found');

    const [allBooks, allTopics, allCourses, academicNeeds, availableCounts, policy] = await Promise.all([
      repos.books.findAll(),
      repos.books.findTopics(),
      repos.books.findCourses(),
      repos.academicNeeds.findByUserId(authenticatedUserId),
      repos.books.countAllAvailablePhysical(),
      repos.policy.getDefaultPolicy(),
    ]);

    const topicLookup = new Map<string, Topic>(allTopics.map((t) => [t.id, t]));
    const courseLookup = new Map<string, Course>(allCourses.map((c) => [c.id, c]));
    const at = now();

    this.engine.indexCatalogue(allBooks, topicLookup, courseLookup);
    const recommendations = this.engine.rankAlternatives({
      sourceBook,
      candidates: allBooks,
      // Needs whose needed-until date has passed no longer influence ranking.
      academicNeeds: academicNeeds.filter((n) => isActiveNeed(n, at)),
      topicLookup,
      courseLookup,
      availablePhysicalCounts: availableCounts,
      policy,
      at,
    });

    return { sourceBook, recommendations };
  }
}
