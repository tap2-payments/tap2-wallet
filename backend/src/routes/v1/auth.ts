/**
 * Authentication Routes
 * User registration, login, profile management, KYC verification, and PIN management
 */

import { Hono } from 'hono'
import type { Env } from '../../index.js'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { AuthService, createAuthError } from '../../services/auth.service.js'
import { UserService } from '../../services/user.service.js'
import { authMiddleware } from '../../middleware/auth.js'

export const authRouter = new Hono<{ Bindings: Env }>()

const authService = new AuthService()
const userService = new UserService()

// ============================================================================
// Validation Schemas
// ============================================================================

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  auth0Id: z.string().optional(),
})

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  password: z.string().min(1, 'Password is required'),
})

const kycVerifySchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  verified: z.boolean(),
  verificationMethod: z.enum(['persona', 'manual']).optional(),
  verificationId: z.string().optional(),
})

const profileUpdateSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').optional(),
}).refine(data => data.email || data.phone, {
  message: 'At least one field (email or phone) must be provided',
})

const pinSetSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
})

const pinVerifySchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
})

// ============================================================================
// Public Routes (No authentication required)
// ============================================================================

/**
 * POST /api/v1/auth/register
 * Register a new user
 */
authRouter.post('/register', zValidator('json', registerSchema), async (c) => {
  try {
    const data = c.req.valid('json')
    const db = c.env.DB

    const result = await authService.register(db, data, async (db, userData) => {
      return await userService.createUser(db, userData)
    })

    return c.json(result, 201)
  } catch (error) {
    // Handle known auth errors
    if (error && typeof error === 'object' && 'code' in error) {
      const authError = error as { error: string; code: string; status: number }
      return c.json({ error: authError.error, code: authError.code }, authError.status)
    }

    // Handle other errors
    const message = error instanceof Error ? error.message : 'Registration failed'
    return c.json({ error: message }, 500)
  }
})

/**
 * POST /api/v1/auth/login
 * Login with email/phone and password
 */
authRouter.post('/login', zValidator('json', loginSchema), async (c) => {
  try {
    const data = c.req.valid('json')
    const db = c.env.DB

    const result = await authService.login(db, data, async (db, email?, phone?) => {
      return await userService.findByEmailOrPhone(db, email, phone)
    })

    return c.json(result)
  } catch (error) {
    // Handle known auth errors
    if (error && typeof error === 'object' && 'code' in error) {
      const authError = error as { error: string; code: string; status: number }
      return c.json({ error: authError.error, code: authError.code }, authError.status)
    }

    // Handle other errors
    const message = error instanceof Error ? error.message : 'Login failed'
    return c.json({ error: message }, 500)
  }
})

// ============================================================================
// Protected Routes (Authentication required)
// ============================================================================

/**
 * GET /api/v1/auth/profile
 * Get current user's profile
 */
authRouter.get('/profile', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const db = c.env.DB

    const profile = await userService.getProfile(db, userId)

    if (!profile) {
      const error = createAuthError('USER_NOT_FOUND')
      return c.json({ error: error.error, code: error.code }, error.status)
    }

    return c.json({ user: profile })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get profile'
    return c.json({ error: message }, 500)
  }
})

/**
 * PUT /api/v1/auth/profile
 * Update current user's profile
 */
authRouter.put('/profile', authMiddleware, zValidator('json', profileUpdateSchema), async (c) => {
  try {
    const userId = c.get('userId')
    const data = c.req.valid('json')
    const db = c.env.DB

    const profile = await userService.updateProfile(db, userId, data)

    if (!profile) {
      const error = createAuthError('USER_NOT_FOUND')
      return c.json({ error: error.error, code: error.code }, error.status)
    }

    return c.json({ user: profile })
  } catch (error) {
    // Handle validation errors (email/phone already in use)
    if (error instanceof Error && (error.message.includes('already') || error.message.includes('in use'))) {
      return c.json({ error: error.message }, 409)
    }

    const message = error instanceof Error ? error.message : 'Failed to update profile'
    return c.json({ error: message }, 500)
  }
})

/**
 * POST /api/v1/auth/verify-kyc
 * Update KYC verification status
 * Note: This should typically be called by an admin or external KYC service
 * For now, users can update their own KYC status (in production, restrict to admins)
 */
authRouter.post('/verify-kyc', authMiddleware, zValidator('json', kycVerifySchema), async (c) => {
  try {
    const data = c.req.valid('json')
    const db = c.env.DB

    // Verify the requesting user is updating their own KYC or is an admin
    const requestingUserId = c.get('userId')

    // For now, allow users to update their own KYC
    // In production, this should be restricted to admins or KYC services
    if (data.userId !== requestingUserId) {
      const error = createAuthError('UNAUTHORIZED')
      return c.json({ error: error.error, code: error.code }, error.status)
    }

    const result = await authService.updateKYC(db, data, async (db, userId, verified) => {
      const profile = await userService.updateKYC(db, userId, verified)
      return profile ? {
        id: profile.id,
        kycVerified: profile.kycVerified,
        kycVerifiedAt: profile.kycVerifiedAt,
      } : null
    })

    if (!result) {
      const error = createAuthError('USER_NOT_FOUND')
      return c.json({ error: error.error, code: error.code }, error.status)
    }

    return c.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update KYC status'
    return c.json({ error: message }, 500)
  }
})

/**
 * POST /api/v1/auth/pin
 * Set or update spending PIN
 */
authRouter.post('/pin', authMiddleware, zValidator('json', pinSetSchema), async (c) => {
  try {
    const userId = c.get('userId')
    const data = c.req.valid('json')
    const db = c.env.DB

    const result = await authService.setPin(db, userId, data, async (db, userId, pinData) => {
      await userService.updatePin(db, userId, pinData.pinHash, pinData.pinSalt)
    })

    return c.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to set PIN'
    return c.json({ error: message }, 500)
  }
})

/**
 * POST /api/v1/auth/pin/verify
 * Verify spending PIN
 */
authRouter.post('/pin/verify', authMiddleware, zValidator('json', pinVerifySchema), async (c) => {
  try {
    const userId = c.get('userId')
    const data = c.req.valid('json')
    const db = c.env.DB
    const kv = c.env.KV // Optional KV for rate limiting

    const result = await authService.verifyPin(db, userId, data, async (db, userId) => {
      return await userService.findById(db, userId)
    }, kv)

    if (!result.success) {
      return c.json(result, 401)
    }

    return c.json(result)
  } catch (error) {
    // Handle known auth errors
    if (error && typeof error === 'object' && 'code' in error) {
      const authError = error as { error: string; code: string; status: number }
      return c.json({ error: authError.error, code: authError.code }, authError.status)
    }

    const message = error instanceof Error ? error.message : 'Failed to verify PIN'
    return c.json({ error: message }, 500)
  }
})

/**
 * GET /api/v1/auth/pin/status
 * Check if user has a PIN set
 */
authRouter.get('/pin/status', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const db = c.env.DB

    const hasPin = await userService.hasPinSet(db, userId)

    return c.json({ hasPin })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check PIN status'
    return c.json({ error: message }, 500)
  }
})

/**
 * POST /api/v1/auth/refresh
 * Refresh access token (placeholder for future implementation)
 */
authRouter.post('/refresh', async (c) => {
  // TODO: Implement refresh token logic
  // For now, return a 501 Not Implemented
  return c.json({ error: 'Refresh token not yet implemented' }, 501)
})
