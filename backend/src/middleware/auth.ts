/**
 * Authentication Middleware
 * Validates JWT tokens and adds user context to Hono requests
 */

import type { Context, Next } from 'hono'
import { AuthService, createAuthError } from '../services/auth.service.js'
import type { Env } from '../index.js'

/**
 * Extended Hono context with authenticated user information
 */
export interface AuthContext {
  userId: string
  email: string
}

/**
 * Authentication middleware options
 */
export interface AuthMiddlewareOptions {
  optional?: boolean // If true, allow unauthenticated requests
  requireKYC?: boolean // If true, require KYC verification
}

/**
 * Create authentication middleware
 * Validates JWT from Authorization header and adds user info to context
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions = {}) {
  const authService = new AuthService()

  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const authHeader = c.req.header('Authorization')

    // If auth is optional and no token provided, continue without user context
    if (options.optional && !authHeader) {
      return next()
    }

    // Validate token
    const payload = await authService.validateAuthHeader(authHeader)

    if (!payload) {
      const error = createAuthError('INVALID_TOKEN')
      return c.json({ error: error.error, code: error.code }, error.status)
    }

    // Add user info to context
    c.set('userId', payload.userId)
    c.set('email', payload.email)

    // Check KYC requirement
    if (options.requireKYC) {
      // For KYC check, we need to query the database
      // This is done in the route handler to avoid circular dependency
      c.set('requireKYC', true)
    }

    return next()
  }
}

/**
 * Standard authentication middleware (required)
 * Use for routes that require authentication
 */
export const authMiddleware = createAuthMiddleware({ optional: false })

/**
 * Optional authentication middleware
 * Use for routes that work with or without authentication
 */
export const optionalAuthMiddleware = createAuthMiddleware({ optional: true })

/**
 * Get authenticated user from context
 * Throws error if user is not authenticated
 */
export function getAuthUser(c: Context<{ Bindings: Env }>): AuthContext {
  const userId = c.get('userId')
  const email = c.get('email')

  if (!userId || !email) {
    throw new Error('User not authenticated')
  }

  return { userId, email }
}

/**
 * Get authenticated user ID from context
 * Returns null if user is not authenticated
 */
export function getUserId(c: Context<{ Bindings: Env }>): string | null {
  return c.get('userId') ?? null
}

/**
 * Helper function to check if user is authenticated
 */
export function isAuthenticated(c: Context<{ Bindings: Env }>): boolean {
  return !!c.get('userId')
}
