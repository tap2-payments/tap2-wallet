/**
 * Rate limiting utilities using Cloudflare KV
 *
 * Implements a sliding window counter for rate limiting.
 * Designed for Cloudflare Workers edge deployment.
 */

import type { Context } from 'hono';

interface RateLimitData {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key
 *
 * @param kv - Cloudflare KV namespace
 * @param key - Unique identifier for rate limit (e.g., IP, userId)
 * @param limit - Maximum requests allowed
 * @param window - Time window in seconds
 * @returns Rate limit result
 *
 * @example
 * ```ts
 * const result = await checkRateLimit(env.KV, 'ip:1.2.3.4:login', 5, 60);
 * if (!result.allowed) {
 *   return c.json({ error: 'Rate limit exceeded' }, 429);
 * }
 * ```
 */
export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  window: number
): Promise<RateLimitResult> {
  const now = Date.now();

  try {
    const existing = await kv.get(key, 'json');
    const data = existing as RateLimitData | null;

    // No existing data or window expired - start fresh
    if (!data || now > data.resetAt) {
      const resetAt = now + window * 1000;
      const newData: RateLimitData = { count: 1, resetAt };

      await kv.put(key, JSON.stringify(newData), {
        expirationTtl: window,
      });

      return {
        allowed: true,
        limit,
        remaining: limit - 1,
        resetAt: Math.ceil(resetAt / 1000),
      };
    }

    // Within window - check limit
    if (data.count >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt: Math.ceil(data.resetAt / 1000),
      };
    }

    // Increment counter
    const newData: RateLimitData = {
      count: data.count + 1,
      resetAt: data.resetAt,
    };

    await kv.put(key, JSON.stringify(newData), {
      expirationTtl: Math.ceil((data.resetAt - now) / 1000),
    });

    return {
      allowed: true,
      limit,
      remaining: limit - newData.count,
      resetAt: Math.ceil(data.resetAt / 1000),
    };
  } catch (error) {
    // On KV errors, allow the request (fail open)
    console.error('Rate limit check failed:', error);
    return {
      allowed: true,
      limit,
      remaining: limit,
      resetAt: Math.ceil((now + window * 1000) / 1000),
    };
  }
}

/**
 * Reset rate limit for a given key
 *
 * Useful for admin actions or testing
 *
 * @param kv - Cloudflare KV namespace
 * @param key - Unique identifier to reset
 */
export async function resetRateLimit(kv: KVNamespace, key: string): Promise<void> {
  await kv.delete(key);
}

/**
 * Rate limit key generators for common patterns
 */
export type RateLimitKeyGenerator = (identifier: string, endpoint: string) => string;

export const RateLimitKeys = {
  /** IP-based rate limiting */
  ip: (ip: string, endpoint: string) => `ratelimit:ip:${ip}:${endpoint}`,

  /** User-based rate limiting */
  user: (userId: string, endpoint: string) => `ratelimit:user:${userId}:${endpoint}`,

  /** Email-based rate limiting (for login attempts) */
  email: (email: string, endpoint: string) => `ratelimit:email:${email}:${endpoint}`,

  /** Phone-based rate limiting */
  phone: (phone: string, endpoint: string) => `ratelimit:phone:${phone}:${endpoint}`,

  /** Global endpoint rate limiting */
  global: (_identifier: string, endpoint: string) => `ratelimit:global:${endpoint}`,
} as const;

/**
 * Standard rate limit configurations per endpoint
 */
export const RateLimitConfig = {
  /** Auth endpoints: 5 requests per minute per IP */
  auth: { limit: 5, window: 60 },

  /** Login endpoint: 3 attempts per 5 minutes per email */
  login: { limit: 3, window: 300 },

  /** Password reset: 1 per hour per email */
  passwordReset: { limit: 1, window: 3600 },

  /** General API: 100 requests per minute per user */
  api: { limit: 100, window: 60 },

  /** Payment operations: 10 per minute per user */
  payment: { limit: 10, window: 60 },

  /** P2P transfers: 5 per minute per user */
  p2p: { limit: 5, window: 60 },
} as const;

/**
 * Create a Hono middleware for rate limiting
 *
 * @param getIdentifier - Function to extract identifier from context
 * @param endpoint - Endpoint name for key generation
 * @param config - Rate limit configuration
 * @param keyGenerator - Optional key generator function (defaults to user-based)
 *
 * @example
 * ```ts
 * import { createRateLimitMiddleware, RateLimitKeys, RateLimitConfig } from '@/lib/rate-limit';
 *
 * // IP-based rate limiting for login
 * app.use(
 *   '/api/v1/auth/login',
 *   createRateLimitMiddleware(
 *     (c) => c.req.header('CF-Connecting-IP') || 'unknown',
 *     'login',
 *     RateLimitConfig.login,
 *     RateLimitKeys.ip
 *   )
 * );
 *
 * // User-based rate limiting for API
 * app.use(
 *   '/api/v1/payments/*',
 *   createRateLimitMiddleware(
 *     (c) => c.get('userId') || 'unknown',
 *     'payments',
 *     RateLimitConfig.payment,
 *     RateLimitKeys.user
 *   )
 * );
 * ```
 */
export function createRateLimitMiddleware<
  E extends {
    KV: KVNamespace;
  }
>(
  getIdentifier: (c: Context<{ Bindings: E }>) => string,
  endpoint: string,
  config: { limit: number; window: number },
  keyGenerator: RateLimitKeyGenerator = RateLimitKeys.user
) {
  return async (c: Context<{ Bindings: E }>, next: () => Promise<void>) => {
    const identifier = getIdentifier(c);
    const key = keyGenerator(identifier, endpoint);

    const result = await checkRateLimit(c.env.KV, key, config.limit, config.window);

    // Add rate limit headers
    c.header('X-RateLimit-Limit', result.limit.toString());
    c.header('X-RateLimit-Remaining', result.remaining.toString());
    c.header('X-RateLimit-Reset', result.resetAt.toString());

    if (!result.allowed) {
      return c.json({ error: 'Rate limit exceeded', retryAfter: result.resetAt }, 429);
    }

    await next();
  };
}
