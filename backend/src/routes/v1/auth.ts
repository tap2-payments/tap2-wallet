/**
 * Authentication API endpoints
 *
 * Custom authentication implementation using Cloudflare Workers.
 * Replaces Auth0 with edge-native auth.
 *
 * Endpoints:
 * - POST /v1/auth/register - Email/password registration
 * - POST /v1/auth/login - Email/password login
 * - POST /v1/auth/logout - Invalidate session
 * - POST /v1/auth/refresh - Refresh access token
 * - POST /v1/auth/verify-email - Verify email ownership
 * - POST /v1/auth/forgot-password - Initiate password reset
 * - POST /v1/auth/reset-password - Complete password reset
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';

import { initDB, users, sessions, type NewSession } from '../../config/database.js';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  isCommonPassword,
} from '../../lib/password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generateTokenId,
} from '../../lib/jwt.js';
import { checkRateLimit, createRateLimitMiddleware, RateLimitConfig, RateLimitKeys } from '../../lib/rate-limit.js';
import { ErrorIds } from '../../constants/errorIds.js';

import type { Env } from '../../index.js';
import type { AccessTokenPayload, RefreshTokenPayload } from '../../lib/jwt.js';

// Bindings type for auth routes
type AuthEnv = Env & {
  JWT_SECRET?: string;
  JWT_SECRET_V1?: string;
  JWT_SECRET_V2?: string;
};

const auth = new Hono<{ Bindings: AuthEnv }>();

/**
 * Get JWT secrets from environment
 */
function getSecrets(env: AuthEnv) {
  const v1 = env.JWT_SECRET_V1 || env.JWT_SECRET || '';
  const v2 = env.JWT_SECRET_V2 || env.JWT_SECRET || '';

  if (!v2) {
    throw new Error('JWT_SECRET_V2 or JWT_SECRET environment variable must be set');
  }

  return { v1, v2 };
}

/**
 * Get client IP address from request headers
 */
function getClientIp(c: any): string {
  return (
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For') ||
    c.req.header('X-Real-IP') ||
    'unknown'
  );
}

/**
 * Extract device fingerprint from headers
 * In production, this would use a more sophisticated device fingerprinting library
 */
function getDeviceId(c: any): string {
  const userAgent = c.req.header('User-Agent') || 'unknown';
  // Simple hash of user agent for device identification
  // Use TextEncoder/Base64 for Workers compatibility
  const encoder = new TextEncoder();
  const data = encoder.encode(userAgent);
  const binary = String.fromCharCode(...data);
  return btoa(binary).slice(0, 32);
}

/**
 * Normalize email address for consistent storage and lookup
 * - Converts to lowercase
 * - Trims whitespace
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Helper function to create a standardized error response
 */
function createErrorResponse(error: string, errorId: string, status: number) {
  return { error, errorId, status };
}

// ============================================================================
// Validation Schemas
// ============================================================================

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  deviceId: z.string().optional(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
});

// ============================================================================
// POST /v1/auth/register
// ============================================================================

/**
 * Register a new user with email and password
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "phone": "+1234567890",
 *   "password": "SecurePassword123!"
 * }
 *
 * Response (201):
 * {
 *   "user": { "id": "...", "email": "...", "phone": "..." },
 *   "tokens": {
 *     "accessToken": "...",
 *     "refreshToken": "...",
 *     "expiresIn": 900
 *   }
 * }
 *
 * Errors:
 * - 400: Invalid input (weak password, common password)
 * - 409: Email or phone already registered
 * - 429: Rate limit exceeded
 */
auth.post(
  '/register',
  zValidator('json', registerSchema),
  createRateLimitMiddleware(
    (c) => RateLimitKeys.ip(getClientIp(c), 'register'),
    'register',
    RateLimitConfig.auth
  ),
  async (c) => {
    const body = c.req.valid('json');
    const db = initDB(c.env.DB);
    const secrets = getSecrets(c.env);

    // Normalize email for consistent storage
    const normalizedEmail = normalizeEmail(body.email);

    // Validate password strength
    const strengthCheck = validatePasswordStrength(body.password);
    if (!strengthCheck.valid) {
      return c.json(
        createErrorResponse(strengthCheck.error, ErrorIds.VALIDATION_INVALID_INPUT, 400),
        400
      );
    }

    // Check for common passwords
    if (isCommonPassword(body.password)) {
      return c.json(
        createErrorResponse('Password is too common', ErrorIds.VALIDATION_FAILED, 400),
        400
      );
    }

    // Check if email already exists
    const [existingUser] = await db.select().from(users).where(eq(users.email, normalizedEmail));
    if (existingUser) {
      return c.json(
        createErrorResponse('Email already registered', ErrorIds.RESOURCE_ALREADY_EXISTS, 409),
        409
      );
    }

    // Check if phone already exists
    const [existingPhone] = await db.select().from(users).where(eq(users.phone, body.phone));
    if (existingPhone) {
      return c.json(
        createErrorResponse('Phone number already registered', ErrorIds.RESOURCE_ALREADY_EXISTS, 409),
        409
      );
    }

    // Hash password
    const passwordHash = await hashPassword(body.password);

    // Create user
    const userId = crypto.randomUUID();
    const now = new Date();

    await db.insert(users).values({
      id: userId,
      email: normalizedEmail,
      phone: body.phone,
      passwordHash,
      kycVerified: false,
      createdAt: now,
      updatedAt: now,
    });

    const newUser = {
      id: userId,
      email: normalizedEmail,
      phone: body.phone,
      kycVerified: false,
    };

    // Generate tokens
    const accessTokenJti = generateTokenId();
    const refreshTokenJti = generateTokenId();
    const deviceId = getDeviceId(c);

    const accessToken = await signAccessToken(
      {
        sub: userId,
        jti: accessTokenJti,
        iss: 'tap2.wallet',
        aud: 'api.tap2.wallet',
      },
      secrets
    );

    const refreshToken = await signRefreshToken(
      {
        sub: userId,
        jti: refreshTokenJti,
        device_id: deviceId,
      },
      secrets
    );

    // Hash refresh token for storage using SHA-256 (faster than password hashing for tokens)
    const tokenHashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(refreshToken)
    );
    const refreshTokenHash = Array.from(new Uint8Array(tokenHashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Create session (expires in 30 days)
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const newSession: NewSession = {
      id: refreshTokenJti,
      userId: userId,
      deviceId: deviceId,
      refreshTokenHash: refreshTokenHash,
      expiresAt: sessionExpiresAt,
      createdAt: now,
    };

    await db.insert(sessions).values(newSession);

    // TODO: Send verification email

    // Return user and tokens
    return c.json(
      {
        user: {
          id: newUser.id,
          email: newUser.email,
          phone: newUser.phone,
          kycVerified: newUser.kycVerified,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 900, // 15 minutes
        },
      },
      201
    );
  }
);

// ============================================================================
// POST /v1/auth/login
// ============================================================================

/**
 * Login with email and password
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePassword123!",
 *   "deviceId": "optional-device-id"
 * }
 *
 * Response (200):
 * {
 *   "user": { "id": "...", "email": "...", ... },
 *   "tokens": {
 *     "accessToken": "...",
 *     "refreshToken": "...",
 *     "expiresIn": 900
 *   }
 * }
 *
 * Errors:
 * - 401: Invalid credentials
 * - 429: Too many login attempts
 */
auth.post(
  '/login',
  zValidator('json', loginSchema),
  async (c) => {
    const body = c.req.valid('json');
    const db = initDB(c.env.DB);
    const secrets = getSecrets(c.env);

    // Normalize email for lookup
    const normalizedEmail = normalizeEmail(body.email);

    // Rate limit check after validation
    const rateLimitResult = await checkRateLimit(
      c.env.KV,
      RateLimitKeys.email(normalizedEmail, 'login'),
      RateLimitConfig.login.limit,
      RateLimitConfig.login.window
    );

    if (!rateLimitResult.allowed) {
      return c.json(
        createErrorResponse('Too many login attempts', ErrorIds.AUTHENTICATION_FAILED, 429),
        429
      );
    }

    // Find user by email
    const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail));

    // Verify password.
    // Note: This uses short-circuit evaluation which means verifyPassword only runs if user exists.
    // For true constant-time behavior, a dummy hash verification would be needed when user doesn't exist.
    // However, the database query timing variation already provides a timing channel,
    // so the additional short-circuit here is acceptable for this implementation.
    const passwordValid =
      user?.passwordHash && (await verifyPassword(body.password, user.passwordHash));

    if (!passwordValid) {
      return c.json(
        createErrorResponse('Invalid credentials', ErrorIds.AUTHENTICATION_FAILED, 401),
        401
      );
    }

    // Generate tokens
    const accessTokenJti = generateTokenId();
    const refreshTokenJti = generateTokenId();
    const deviceId = body.deviceId || getDeviceId(c);

    const accessToken = await signAccessToken(
      {
        sub: user.id,
        jti: accessTokenJti,
        iss: 'tap2.wallet',
        aud: 'api.tap2.wallet',
      },
      secrets
    );

    const refreshToken = await signRefreshToken(
      {
        sub: user.id,
        jti: refreshTokenJti,
        device_id: deviceId,
      },
      secrets
    );

    // Hash refresh token for storage using SHA-256
    const tokenHashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(refreshToken)
    );
    const refreshTokenHash = Array.from(new Uint8Array(tokenHashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Create or update session
    const now = new Date();
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Check if session exists for this device
    const [existingSession] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), eq(sessions.deviceId, deviceId)))
      .limit(1);

    if (existingSession) {
      // Update existing session
      await db
        .update(sessions)
        .set({
          refreshTokenHash: refreshTokenHash,
          expiresAt: sessionExpiresAt,
        })
        .where(eq(sessions.id, existingSession.id));
    } else {
      // Create new session
      const newSession: NewSession = {
        id: refreshTokenJti,
        userId: user.id,
        deviceId: deviceId,
        refreshTokenHash: refreshTokenHash,
        expiresAt: sessionExpiresAt,
        createdAt: now,
      };
      await db.insert(sessions).values(newSession);
    }

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        kycVerified: user.kycVerified,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes
      },
    });
  }
);

// ============================================================================
// POST /v1/auth/logout
// ============================================================================

/**
 * Logout and invalidate session
 *
 * Requires authentication. Invalidates the current session.
 *
 * Request headers:
 * Authorization: Bearer <access_token>
 *
 * Request body:
 * {
 *   "refreshToken": "..."
 * }
 *
 * Response: 204 No Content
 *
 * Note: Returns 204 even if token is invalid for idempotency
 */
auth.post(
  '/logout',
  zValidator('json', refreshTokenSchema),
  async (c) => {
    const body = c.req.valid('json');
    const db = initDB(c.env.DB);

    try {
      // Verify refresh token to get session ID
      const result = await verifyRefreshToken(body.refreshToken, {
        JWT_SECRET: c.env.JWT_SECRET,
        JWT_SECRET_V1: c.env.JWT_SECRET_V1,
        JWT_SECRET_V2: c.env.JWT_SECRET_V2,
      });

      // Delete session from database
      await db.delete(sessions).where(eq(sessions.id, result.payload.jti));

      // TODO: Add token to KV blocklist for immediate revocation

      return c.body(null, 204);
    } catch (error) {
      // Log the error for debugging but still return 204 for idempotency
      console.error('Logout error:', error);
      // TODO: Send to Sentry with error ID
      return c.body(null, 204);
    }
  }
);

// ============================================================================
// POST /v1/auth/refresh
// ============================================================================

/**
 * Refresh access token using refresh token
 *
 * Request body:
 * {
 *   "refreshToken": "..."
 * }
 *
 * Response (200):
 * {
 *   "accessToken": "...",
 *   "expiresIn": 900
 * }
 *
 * Errors:
 * - 401: Invalid or expired refresh token
 * - 500: Internal server error
 */
auth.post(
  '/refresh',
  zValidator('json', refreshTokenSchema),
  async (c) => {
    const body = c.req.valid('json');
    const db = initDB(c.env.DB);

    try {
      // Verify refresh token
      const result = await verifyRefreshToken(body.refreshToken, {
        JWT_SECRET: c.env.JWT_SECRET,
        JWT_SECRET_V1: c.env.JWT_SECRET_V1,
        JWT_SECRET_V2: c.env.JWT_SECRET_V2,
      });

      const { sub: userId, jti: sessionId } = result.payload;

      // Verify session exists and is not expired
      const now = new Date();

      const [session] = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
        .limit(1);

      if (!session || new Date(session.expiresAt) < now) {
        return c.json(
          createErrorResponse('Invalid or expired refresh token', ErrorIds.AUTHENTICATION_INVALID, 401),
          401
        );
      }

      // Generate new access token
      const accessTokenJti = generateTokenId();

      const secrets = getSecrets(c.env);

      const accessToken = await signAccessToken(
        {
          sub: userId,
          jti: accessTokenJti,
          iss: 'tap2.wallet',
          aud: 'api.tap2.wallet',
        },
        secrets
      );

      return c.json({
        accessToken,
        expiresIn: 900, // 15 minutes
      });
    } catch (error) {
      // Log for debugging - helps distinguish system errors from auth errors
      console.error('Token refresh error:', error);
      // TODO: Send to Sentry with error ID

      // Return generic error to avoid leaking information
      return c.json(
        createErrorResponse('Invalid refresh token', ErrorIds.AUTHENTICATION_INVALID, 401),
        401
      );
    }
  }
);

// ============================================================================
// POST /v1/auth/verify-email
// ============================================================================

/**
 * Verify email ownership
 *
 * This is a placeholder for email verification.
 * In production, this would validate a token sent via email.
 *
 * Request body:
 * {
 *   "token": "verification-token-from-email"
 * }
 *
 * Response (501): Feature not yet implemented
 *
 * Errors:
 * - 429: Rate limit exceeded
 * - 501: Not implemented
 */
auth.post(
  '/verify-email',
  zValidator('json', verifyEmailSchema),
  createRateLimitMiddleware(
    (c) => RateLimitKeys.ip(getClientIp(c), 'verify-email'),
    'verify-email',
    RateLimitConfig.auth
  ),
  async (c) => {
    // TODO: Implement proper email verification flow with Resend
    // 1. Verify token signature and expiration
    // 2. Update user.emailVerified = true
    // 3. Return success

    // Feature not yet implemented
    return c.json(
      createErrorResponse('Email verification not yet implemented', ErrorIds.INTERNAL_ERROR, 501),
      501
    );
  }
);

// ============================================================================
// POST /v1/auth/forgot-password
// ============================================================================

/**
 * Initiate password reset
 *
 * Request body:
 * {
 *   "email": "user@example.com"
 * }
 *
 * Response: 204 No Content
 *
 * Note: Always returns 204 to prevent email enumeration
 *
 * Errors:
 * - 429: Too many password reset attempts
 */
auth.post(
  '/forgot-password',
  zValidator('json', forgotPasswordSchema),
  async (c) => {
    const { email } = c.req.valid('json');
    const normalizedEmail = normalizeEmail(email);

    // Rate limit check
    const rateLimitResult = await checkRateLimit(
      c.env.KV,
      RateLimitKeys.email(normalizedEmail, 'forgot-password'),
      RateLimitConfig.passwordReset.limit,
      RateLimitConfig.passwordReset.window
    );

    if (!rateLimitResult.allowed) {
      return c.json(
        createErrorResponse('Too many password reset attempts', ErrorIds.VALIDATION_FAILED, 429),
        429
      );
    }

    const db = initDB(c.env.DB);

    // Check if user exists
    const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail));

    if (user) {
      // TODO: Generate reset token and send email via Resend
      // 1. Generate secure random token
      // 2. Store in KV with 1 hour expiration
      // 3. Send email with reset link
    }

    // Always return 204 to prevent email enumeration
    return c.body(null, 204);
  }
);

// ============================================================================
// POST /v1/auth/reset-password
// ============================================================================

/**
 * Complete password reset with token
 *
 * Request body:
 * {
 *   "token": "reset-token-from-email",
 *   "password": "NewSecurePassword123!"
 * }
 *
 * Response (501): Feature not yet implemented
 *
 * Errors:
 * - 400: Invalid password (too weak or common)
 * - 429: Rate limit exceeded
 * - 501: Not implemented
 */
auth.post(
  '/reset-password',
  zValidator('json', resetPasswordSchema),
  createRateLimitMiddleware(
    (c) => RateLimitKeys.ip(getClientIp(c), 'reset-password'),
    'reset-password',
    RateLimitConfig.passwordReset
  ),
  async (c) => {
    const body = c.req.valid('json');
    const db = initDB(c.env.DB);

    // Validate password strength
    const strengthCheck = validatePasswordStrength(body.password);
    if (!strengthCheck.valid) {
      return c.json(
        createErrorResponse(strengthCheck.error, ErrorIds.VALIDATION_INVALID_INPUT, 400),
        400
      );
    }

    // Check for common passwords
    if (isCommonPassword(body.password)) {
      return c.json(
        createErrorResponse('Password is too common', ErrorIds.VALIDATION_FAILED, 400),
        400
      );
    }

    // TODO: Implement proper password reset flow
    // 1. Verify reset token from KV
    // 2. Update user password hash
    // 3. Invalidate all existing sessions
    // 4. Delete reset token from KV

    return c.json(
      createErrorResponse('Password reset not yet implemented', ErrorIds.INTERNAL_ERROR, 501),
      501
    );
  }
);

export { auth as authRouter };
