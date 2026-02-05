import { type Request, type Response, type NextFunction } from 'express';
import { UnauthorizedError } from '../utils/errors.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        phone: string;
      };
    }
  }
}

/**
 * Authentication middleware
 *
 * Verifies JWT tokens and attaches user to request.
 *
 * NOTE: This is a stub implementation for the foundation.
 * Full JWT verification with Auth0 JWKS will be implemented in Sprint 1.
 *
 * For now, it extracts user from x-user-id header for development.
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // TODO: Sprint 1 - Implement full JWT verification with Auth0 JWKS
  // For development, accept x-user-id header
  const userId = req.headers['x-user-id'] as string;

  if (!userId) {
    throw new UnauthorizedError('Missing authentication token');
  }

  // Stub: Attach user to request
  // In Sprint 1, this will decode and verify JWT from Authorization header
  req.user = {
    id: userId,
    email: '',
    phone: '',
  };

  next();
}

/**
 * Optional authentication - doesn't fail if no token
 */
export function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const userId = req.headers['x-user-id'] as string;

  if (userId) {
    req.user = {
      id: userId,
      email: '',
      phone: '',
    };
  }

  next();
}
