/**
 * Authentication middleware for Cloudflare Workers / Hono
 *
 * Provides JWT-based authentication with automatic token verification
 * and user context injection.
 */

import type { Context, Next } from 'hono';
import { verifyAccessToken, type AccessTokenPayload } from '@/lib/jwt.js';

/**
 * Extended Hono variables with authenticated user info
 */
export type AuthVariables = {
  userId: string;
  tokenId: string;
};

/**
 * Extended Hono environment with auth variables
 */
export type AuthContext = Context<{ Variables: AuthVariables }>;

/**
 * Authentication error types
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Extract and verify JWT from Authorization header
 *
 * @param authorization - The Authorization header value
 * @param env - Environment variables containing JWT secrets
 * @returns The verified token payload
 * @throws AuthError if token is invalid or missing
 */
async function extractAuthToken(
  authorization: string | undefined,
  env: { JWT_SECRET?: string; JWT_SECRET_V1?: string; JWT_SECRET_V2?: string }
): Promise<AccessTokenPayload> {
  if (!authorization) {
    throw new AuthError('Missing Authorization header', 401);
  }

  // Support both "Bearer token" and "token" formats
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : authorization;

  if (!token) {
    throw new AuthError('Invalid Authorization header format', 401);
  }

  try {
    const result = await verifyAccessToken(token, env);
    return result.payload;
  } catch (error) {
    if (error instanceof Error) {
      // Check for expired token
      if (error.message.includes('expired')) {
        throw new AuthError('Token expired', 401);
      }
    }
    throw new AuthError('Invalid token', 401);
  }
}

/**
 * Authentication middleware for Hono
 *
 * Verifies JWT access token and injects userId into context variables.
 *
 * @example
 * ```ts
 * import { authMiddleware } from '@/lib/auth';
 *
 * app.use('/api/v1/protected/*', authMiddleware);
 *
 * app.get('/api/v1/protected/profile', (c) => {
 *   const userId = c.get('userId');
 *   return c.json({ userId });
 * });
 * ```
 */
export const authMiddleware = async (c: Context, next: Next) => {
  const authorization = c.req.header('Authorization');

  try {
    const payload = await extractAuthToken(authorization, c.env);

    // Inject user info into context
    c.set('userId', payload.sub);
    c.set('tokenId', payload.jti);

    await next();
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json(
        {
          error: error.message,
          code: error.statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
        },
        error.statusCode as 401 | 403
      );
    }
    return c.json({ error: 'Authentication failed' }, 401);
  }
};

/**
 * Optional authentication middleware
 *
 * Attaches userId to context if token is valid, but doesn't require it.
 * Useful for endpoints that have different behavior for authenticated vs anonymous users.
 *
 * @example
 * ```ts
 * app.use('/api/v1/merchants', optionalAuthMiddleware);
 *
 * app.get('/api/v1/merchants', (c) => {
 *   const userId = c.get('userId'); // undefined if not authenticated
 *   // Return personalized or general results
 * });
 * ```
 */
export const optionalAuthMiddleware = async (c: Context, next: Next) => {
  const authorization = c.req.header('Authorization');

  if (!authorization) {
    await next();
    return;
  }

  try {
    const payload = await extractAuthToken(authorization, c.env);
    c.set('userId', payload.sub);
    c.set('tokenId', payload.jti);
  } catch {
    // Silent failure - user remains anonymous
  }

  await next();
};

/**
 * Require specific user attribute (e.g., KYC verified)
 *
 * @param check - Function to check if user meets requirement
 *
 * @example
 * ```ts
 * import { requireUserAttribute } from '@/lib/auth';
 * import { initDB } from '@/config/database';
 * import { users } from '@/drizzle/schema';
 * import { eq } from 'drizzle-orm';
 *
 * const requireKYC = requireUserAttribute(async (userId, env) => {
 *   const db = initDB(env.DB);
 *   const [user] = await db.select().from(users).where(eq(users.id, userId));
 *   return user?.kycVerified ?? false;
 * });
 *
 * app.use('/api/v1/payments/*', authMiddleware, requireKYC);
 * ```
 */
export function requireUserAttribute(
  check: (userId: string, env: { DB: D1Database; KV: KVNamespace; R2: R2Bucket }) => Promise<boolean>
) {
  return async (c: Context, next: Next) => {
    const userId = c.get('userId');

    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    try {
      const passes = await check(userId, c.env);

      if (!passes) {
        return c.json({ error: 'Forbidden', code: 'REQUIREMENT_NOT_MET' }, 403);
      }

      await next();
    } catch (error) {
      console.error('User attribute check failed:', error);
      return c.json({ error: 'Forbidden' }, 403);
    }
  };
}

/**
 * Helper to get authenticated user ID from context
 * Throws if not authenticated (useful in protected route handlers)
 *
 * @example
 * ```ts
 * app.get('/api/v1/profile', authMiddleware, (c) => {
 *   const userId = getUserId(c);
 *   // userId is guaranteed to be a string
 * });
 * ```
 */
export function getUserId(c: AuthContext): string {
  const userId = c.get('userId');
  if (!userId) {
    throw new AuthError('Not authenticated');
  }
  return userId;
}
