import { type Request, type Response, type NextFunction } from 'express';
import { AppError } from '../utils/errors.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error:', err);

  // Check if it's one of our custom AppErrors with a status code
  const status = err instanceof AppError ? err.statusCode : 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    error: message,
    timestamp: new Date().toISOString(),
    path: req.path,
  });
}
