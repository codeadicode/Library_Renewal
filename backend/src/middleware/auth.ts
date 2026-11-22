import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthService } from '../services/AuthService';

export interface AuthenticatedRequest extends Request {
  /** Identity from the verified JWT. Profile data is always loaded from the database. */
  user?: { id: string; studentId: string };
}

export function createAuthMiddleware(authService: AuthService): RequestHandler {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication token missing or invalid' });
      return;
    }

    try {
      const claims = authService.verifyToken(authHeader.slice('Bearer '.length).trim());
      req.user = { id: claims.sub, studentId: claims.studentId };
      next();
    } catch {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired authentication token' });
    }
  };
}
