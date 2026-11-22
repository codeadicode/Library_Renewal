export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (message: string) => new HttpError(404, message, 'NOT_FOUND');
export const forbidden = (message: string) => new HttpError(403, message, 'FORBIDDEN');
export const conflict = (message: string, code = 'CONFLICT') => new HttpError(409, message, code);
export const unauthorized = (message: string) => new HttpError(401, message, 'UNAUTHORIZED');
