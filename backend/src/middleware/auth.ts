import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { SafeUser } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication token missing or invalid',
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as SafeUser;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired authentication token',
    });
  }
}

