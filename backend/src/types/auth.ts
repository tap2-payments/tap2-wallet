/**
 * Authentication-related types for Tap2 Wallet
 * All authentication types, JWT payloads, request/response schemas
 */

/**
 * JWT payload structure
 */
export interface JWTPayload {
  userId: string
  email: string
  iat: number // Issued at (seconds since epoch)
  exp: number // Expiration (seconds since epoch)
}

/**
 * User registration input
 */
export interface RegisterInput {
  email: string
  phone: string
  password: string
  auth0Id?: string
}

/**
 * User registration response
 */
export interface RegisterResponse {
  user: UserResponse
  token: string
  expiresIn: number // Seconds until token expires
}

/**
 * Login input
 */
export interface LoginInput {
  identifier: string // Email or phone
  password: string
}

/**
 * Login response
 */
export interface LoginResponse {
  user: UserResponse
  token: string
  expiresIn: number // Seconds until token expires
}

/**
 * User response for auth endpoints
 */
export interface UserResponse {
  id: string
  email: string
  phone: string
  auth0Id?: string
  kycVerified: boolean
  kycVerifiedAt?: Date | null
  createdAt: Date
}

/**
 * Profile update input
 */
export interface ProfileUpdateInput {
  email?: string
  phone?: string
}

/**
 * KYC verification input
 */
export interface KYCVerifyInput {
  userId: string
  verified: boolean
  verificationMethod?: 'persona' | 'manual'
  verificationId?: string
}

/**
 * KYC verification response
 */
export interface KYCVerifyResponse {
  userId: string
  kycVerified: boolean
  kycVerifiedAt?: Date
}

/**
 * PIN set/update input
 */
export interface PinSetInput {
  pin: string // 4-6 digit PIN
}

/**
 * PIN verification input
 */
export interface PinVerifyInput {
  pin: string
}

/**
 * PIN response
 */
export interface PinResponse {
  success: boolean
  message?: string
}

/**
 * Auth error types
 */
export type AuthError =
  | 'USER_NOT_FOUND'
  | 'INVALID_CREDENTIALS'
  | 'USER_ALREADY_EXISTS'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'UNAUTHORIZED'
  | 'INVALID_PIN'
  | 'PIN_NOT_SET'

/**
 * Hashed password storage format
 * Using PBKDF2 with SHA-256 for Web Crypto API compatibility
 */
export interface HashedPassword {
  hash: string // Base64 encoded hash
  salt: string // Base64 encoded salt
  iterations: number
  algorithm: string
}

/**
 * Refresh token payload (for future implementation)
 */
export interface RefreshTokenPayload {
  userId: string
  tokenId: string
  iat: number
  exp: number
}
