import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { BookService } from '../services/BookService';

export class BookController {
  constructor(private bookService: BookService) {}

  public getBooks = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { q, category, courseId, type, available } = req.query;
      const result = await this.bookService.searchBooks({
        q: q ? String(q) : undefined,
        category: category ? String(category) : undefined,
        courseId: courseId ? String(courseId) : undefined,
        type: type ? String(type) : undefined,
        available: available === 'true' ? true : available === 'false' ? false : undefined,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public getBookById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      const result = await this.bookService.getBookDetail(id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public reserveBook = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const bookId = req.params.id;
      const userId = req.user!.id;
      const { reservation, created } = await this.bookService.reserveBook(bookId, userId);
      res.status(created ? 201 : 200).json({
        message: created ? 'Simulated hold placed successfully' : 'You already hold an active reservation for this title',
        reservation,
      });
    } catch (err) {
      next(err);
    }
  };

  public getTopics = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const topics = await this.bookService.getTopics();
      res.status(200).json(topics);
    } catch (err) {
      next(err);
    }
  };

  public getCourses = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const courses = await this.bookService.getCourses();
      res.status(200).json(courses);
    } catch (err) {
      next(err);
    }
  };
}

