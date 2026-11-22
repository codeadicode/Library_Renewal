import { DataStore } from '../repositories/interfaces';
import { Book, BookCopy, Course, Reservation, Topic } from '../types';
import { conflict, notFound } from '../lib/errors';

const isDigitallyAccessible = (b: Book) => Boolean(b.digitalUrl && b.digitalUrl.startsWith('http'));

export class BookService {
  constructor(private store: DataStore) {}

  public getAllBooks(): Promise<Book[]> {
    return this.store.repos.books.findAll();
  }

  public async searchBooks(query: {
    q?: string;
    category?: string;
    courseId?: string;
    type?: string;
    available?: boolean;
  }): Promise<{ books: Book[]; availableCounts: Record<string, number> }> {
    const { books } = this.store.repos;
    let list = await books.search(query);
    const availableCountsMap = await books.countAllAvailablePhysical();

    if (query.available !== undefined) {
      list = list.filter((b) => {
        const accessible = (availableCountsMap.get(b.id) || 0) > 0 || isDigitallyAccessible(b);
        return query.available ? accessible : !accessible;
      });
    }

    const availableCounts: Record<string, number> = {};
    for (const b of list) availableCounts[b.id] = availableCountsMap.get(b.id) || 0;
    return { books: list, availableCounts };
  }

  public async getBookDetail(id: string): Promise<{
    book: Book;
    copies: BookCopy[];
    availablePhysical: number;
    digitalAccessible: boolean;
    activeReservations: number;
    topics: Topic[];
    courses: Course[];
  }> {
    const { books, reservations } = this.store.repos;
    const book = await books.findById(id);
    if (!book) throw notFound('Book not found in catalogue');

    const [copies, allTopics, allCourses, holds] = await Promise.all([
      books.findCopiesByBookId(id),
      books.findTopics(),
      books.findCourses(),
      reservations.findActiveByBookId(id),
    ]);

    return {
      book,
      copies,
      availablePhysical: copies.filter((c) => c.status === 'AVAILABLE').length,
      digitalAccessible: isDigitallyAccessible(book),
      activeReservations: holds.length,
      topics: allTopics.filter((t) => book.topicIds.includes(t.id)),
      courses: allCourses.filter((c) => book.courseIds.includes(c.id)),
    };
  }

  public async reserveBook(bookId: string, userId: string): Promise<{ reservation: Reservation; created: boolean }> {
    return this.store.transaction(async (tx) => {
      const book = await tx.books.findById(bookId);
      if (!book) throw notFound('Book not found');

      const myLoans = await tx.loans.findByUserId(userId);
      if (myLoans.some((l) => l.bookId === bookId && l.status !== 'RETURNED')) {
        throw conflict('You already have this book issued.', 'ALREADY_BORROWED');
      }

      const existing = (await tx.reservations.findByUserId(userId)).find(
        (r) => r.bookId === bookId && r.status === 'ACTIVE',
      );
      if (existing) return { reservation: existing, created: false };

      // A partial unique index also guards this in PostgreSQL against racing requests.
      const reservation = await tx.reservations.create({ bookId, userId, status: 'ACTIVE' });
      return { reservation, created: true };
    });
  }

  public getTopics(): Promise<Topic[]> {
    return this.store.repos.books.findTopics();
  }

  public getCourses(): Promise<Course[]> {
    return this.store.repos.books.findCourses();
  }
}
