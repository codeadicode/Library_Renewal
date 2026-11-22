import { IBookRepository, IReservationRepository } from '../repositories/interfaces';
import { Book, BookCopy, Course, Reservation, Topic } from '../types';

export class BookService {
  constructor(
    private bookRepo: IBookRepository,
    private reservationRepo: IReservationRepository,
  ) {}

  public async getAllBooks(): Promise<Book[]> {
    return this.bookRepo.findAll();
  }

  public async searchBooks(query: {
    q?: string;
    category?: string;
    courseId?: string;
    type?: string;
    available?: boolean;
  }): Promise<{ books: Book[]; availableCounts: Record<string, number> }> {
    let list = await this.bookRepo.search(query);
    const availableCountsMap = await this.bookRepo.countAllAvailablePhysical();

    if (query.available !== undefined) {
      list = list.filter((b) => {
        const physicalFree = (availableCountsMap.get(b.id) || 0) > 0;
        const digitalFree = Boolean(b.digitalUrl && b.digitalUrl.startsWith('http'));
        const accessible = physicalFree || digitalFree;
        return query.available ? accessible : !accessible;
      });
    }

    const availableCounts: Record<string, number> = {};
    for (const b of list) {
      availableCounts[b.id] = availableCountsMap.get(b.id) || 0;
    }

    return { books: list, availableCounts };
  }

  public async getBookDetail(id: string): Promise<{
    book: Book;
    copies: BookCopy[];
    availablePhysical: number;
    topics: Topic[];
    courses: Course[];
  }> {
    const book = await this.bookRepo.findById(id);
    if (!book) {
      const err = new Error('Book not found in catalogue');
      (err as any).statusCode = 404;
      throw err;
    }

    const [copies, allTopics, allCourses] = await Promise.all([
      this.bookRepo.findCopiesByBookId(id),
      this.bookRepo.findTopics(),
      this.bookRepo.findCourses(),
    ]);

    const availablePhysical = copies.filter((c) => c.status === 'AVAILABLE').length;
    const topics = allTopics.filter((t) => book.topicIds.includes(t.id));
    const courses = allCourses.filter((c) => book.courseIds.includes(c.id));

    return {
      book,
      copies,
      availablePhysical,
      topics,
      courses,
    };
  }

  public async reserveBook(bookId: string, userId: string): Promise<Reservation> {
    const book = await this.bookRepo.findById(bookId);
    if (!book) {
      const err = new Error('Book not found');
      (err as any).statusCode = 404;
      throw err;
    }

    // Check if user already has an active reservation
    const existing = await this.reservationRepo.findByUserId(userId);
    const alreadyReserved = existing.find((r) => r.bookId === bookId && r.status === 'ACTIVE');
    if (alreadyReserved) {
      return alreadyReserved;
    }

    return this.reservationRepo.create({
      bookId,
      userId,
      status: 'ACTIVE',
    });
  }

  public async getTopics(): Promise<Topic[]> {
    return this.bookRepo.findTopics();
  }

  public async getCourses(): Promise<Course[]> {
    return this.bookRepo.findCourses();
  }
}

