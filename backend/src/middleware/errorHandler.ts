import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { config } from '../config';
import { HttpError } from '../lib/errors';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Request payload validation failed',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
    return;
  }

  if (err instanceof HttpError) {
    const code =
      err.code || (err.statusCode === 404 ? 'NOT_FOUND' : err.statusCode === 403 ? 'FORBIDDEN' : 'ERROR');
    res.status(err.statusCode).json({ error: code, message: err.message });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'CONFLICT', message: 'A record with these details already exists.' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Record not found.' });
      return;
    }
  }

  // Express body-parser errors (malformed JSON etc.) carry a 4xx status.
  const status = (err as { status?: number; statusCode?: number }).statusCode ?? (err as { status?: number }).status;
  if (status && status >= 400 && status < 500) {
    res.status(status).json({ error: 'BAD_REQUEST', message: err.message });
    return;
  }

  console.error('[LibTrack] Unhandled error:', err);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: config.nodeEnv === 'production' ? 'Internal server error' : err.message || 'Internal server error',
  });
}
