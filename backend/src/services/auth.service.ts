/**
 * Authentication Service
 * Handles JWT generation/validation, password hashing, user registration, login, KYC, and PIN management
 * Uses Web Crypto API for Cloudflare Workers compatibility
 */

import type {
  HashedPassword,
  JWTPayload,
  RegisterInput,
  RegisterResponse,
  LoginInput,
  LoginResponse,
  KYCVerifyInput,
  KYCVerifyResponse,
  PinSetInput,
  PinVerifyInput,
  PinResponse,
  AuthError,
} from '../types/auth.js'

const JWT_SECRET = import.meta.env.JWT_SECRET || 'tap2-wallet-jwt-secret'
const JWT_EXPIRATION = 15 * 60 // 15 minutes in seconds

/**
 * PBKDF2 configuration for password hashing
 */
const PBKDF2_CONFIG = {
  algorithm: 'PBKDF2' as const,
  hash: 'SHA-256' as const,
  iterations: 100000,
  keyLength: 32, // 256 bits
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Convert Base64 string to Uint8Array
 */
function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Hash a password using PBKDF2
 */
export async function hashPassword(password: string): Promise<HashedPassword> {
  // Generate a random salt
  const saltBuffer = await crypto.subtle.generateKey(
    {
      name: PBKDF2_CONFIG.algorithm,
      length: PBKDF2_CONFIG.keyLength * 8,
    },
    true,
    ['deriveBits']
  )

  const exportedSalt = await crypto.subtle.exportKey('raw', saltBuffer)

  // Import the password as a key
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: PBKDF2_CONFIG.algorithm },
    false,
    ['deriveBits']
  )

  // Derive the hash
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: PBKDF2_CONFIG.algorithm,
      salt: exportedSalt,
      iterations: PBKDF2_CONFIG.iterations,
      hash: PBKDF2_CONFIG.hash,
    },
    passwordKey,
    PBKDF2_CONFIG.keyLength * 8
  )

  return {
    hash: arrayBufferToBase64(hashBuffer),
    salt: arrayBufferToBase64(exportedSalt),
    iterations: PBKDF2_CONFIG.iterations,
    algorithm: 'PBKDF2-SHA256',
  }
}

/**
 * Verify a password against a stored hash
 */
export async function verifyPassword(
  password: string,
  storedHash: HashedPassword
): Promise<boolean> {
  try {
    const saltBuffer = base64ToArrayBuffer(storedHash.salt)

    // Import the password as a key
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: PBKDF2_CONFIG.algorithm },
      false,
      ['deriveBits']
    )

    // Derive the hash
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: PBKDF2_CONFIG.algorithm,
        salt: saltBuffer,
        iterations: storedHash.iterations,
        hash: PBKDF2_CONFIG.hash,
      },
      passwordKey,
      PBKDF2_CONFIG.keyLength * 8
    )

    const computedHash = arrayBufferToBase64(hashBuffer)
    return computedHash === storedHash.hash
  } catch {
    return false
  }
}

/**
 * Generate a JWT token
 * Uses Web Crypto API to sign the token
 */
export async function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + JWT_EXPIRATION

  const jwtPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp,
  }

  // Create the JWT header
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload))

  // Create signature
  const data = `${encodedHeader}.${encodedPayload}`
  const signature = await signData(data, JWT_SECRET)

  return `${data}.${signature}`
}

/**
 * Verify a JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const [encodedHeader, encodedPayload, signature] = parts

    // Verify signature
    const data = `${encodedHeader}.${encodedPayload}`
    const expectedSignature = await signData(data, JWT_SECRET)

    if (signature !== expectedSignature) {
      return null
    }

    // Decode payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JWTPayload

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

/**
 * Sign data using HMAC-SHA256
 */
async function signData(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return base64UrlEncode(new Uint8Array(signature))
}

/**
 * Base64URL encode (safe for JWTs)
 */
function base64UrlEncode(data: string | Uint8Array): string {
  const base64 =
    typeof data === 'string'
      ? btoa(data)
      : btoa(String.fromCharCode.apply(null, Array.from(data)))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Base64URL decode
 */
function base64UrlDecode(data: string): string {
  let base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return atob(base64)
}

/**
 * User record from database
 */
interface UserRecord {
  id: string
  email: string
  phone: string
  auth0Id: string | null
  passwordHash: string | null
  passwordSalt: string | null
  passwordIterations: number | null
  pinHash: string | null
  pinSalt: string | null
  kycVerified: boolean | null
  kycVerifiedAt: number | null
  createdAt: number
  updatedAt: number
}

/**
 * Format user response (exclude sensitive data)
 */
function formatUserResponse(user: UserRecord): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    auth0Id: user.auth0Id ?? undefined,
    kycVerified: user.kycVerified ?? false,
    kycVerifiedAt: user.kycVerifiedAt ? new Date(user.kycVerifiedAt * 1000) : null,
    createdAt: new Date(user.createdAt * 1000),
  }
}

/**
 * Create auth error response
 */
function createAuthError(error: AuthError): { error: string; code: AuthError; status: number } {
  const errorMap: Record<AuthError, { message: string; status: number }> = {
    USER_NOT_FOUND: { message: 'User not found', status: 404 },
    INVALID_CREDENTIALS: { message: 'Invalid email or password', status: 401 },
    USER_ALREADY_EXISTS: { message: 'User with this email or phone already exists', status: 409 },
    INVALID_TOKEN: { message: 'Invalid authentication token', status: 401 },
    TOKEN_EXPIRED: { message: 'Authentication token has expired', status: 401 },
    UNAUTHORIZED: { message: 'Unauthorized access', status: 403 },
    INVALID_PIN: { message: 'Invalid PIN', status: 401 },
    PIN_NOT_SET: { message: 'PIN not set. Please set a spending PIN first.', status: 400 },
  }

  const { message, status } = errorMap[error]
  return { error: message, code: error, status }
}

/**
 * Extract email/phone from identifier
 */
function extractIdentifier(identifier: string): { email?: string; phone?: string } {
  // Check if it looks like an email
  if (identifier.includes('@')) {
    return { email: identifier }
  }
  // Otherwise treat as phone
  return { phone: identifier }
}

export class AuthService {
  /**
   * Register a new user
   */
  async register(
    db: D1Database,
    input: RegisterInput,
    createUserFn: (db: D1Database, data: {
      email: string
      phone: string
      passwordHash: string
      passwordSalt: string
      passwordIterations: number
      auth0Id?: string
    }) => Promise<UserRecord>
  ): Promise<RegisterResponse> {
    // Check if user already exists
    const existingUser = await this.findUserByIdentifier(db, input.email)
    if (existingUser) {
      throw createAuthError('USER_ALREADY_EXISTS')
    }

    // Hash the password
    const hashedPassword = await hashPassword(input.password)

    // Create user with password
    const user = await createUserFn(db, {
      email: input.email,
      phone: input.phone,
      passwordHash: hashedPassword.hash,
      passwordSalt: hashedPassword.salt,
      passwordIterations: hashedPassword.iterations,
      auth0Id: input.auth0Id,
    })

    // Generate token
    const token = await generateToken({
      userId: user.id,
      email: user.email,
    })

    return {
      user: formatUserResponse(user),
      token,
      expiresIn: JWT_EXPIRATION,
    }
  }

  /**
   * Login with email/phone and password
   */
  async login(
    db: D1Database,
    input: LoginInput,
    findUserFn: (db: D1Database, email?: string, phone?: string) => Promise<UserRecord | null>
  ): Promise<LoginResponse> {
    const { email, phone } = extractIdentifier(input.identifier)

    // Find user
    const user = await findUserFn(db, email, phone)
    if (!user || !user.passwordHash) {
      throw createAuthError('INVALID_CREDENTIALS')
    }

    // Verify password
    const hashedPassword: HashedPassword = {
      hash: user.passwordHash,
      salt: user.passwordSalt,
      iterations: user.passwordIterations,
      algorithm: 'PBKDF2-SHA256',
    }

    const isValid = await verifyPassword(input.password, hashedPassword)
    if (!isValid) {
      throw createAuthError('INVALID_CREDENTIALS')
    }

    // Generate token
    const token = await generateToken({
      userId: user.id,
      email: user.email,
    })

    return {
      user: formatUserResponse(user),
      token,
      expiresIn: JWT_EXPIRATION,
    }
  }

  /**
   * Verify a JWT token and return the payload
   */
  async verifyToken(token: string): Promise<JWTPayload | null> {
    return verifyToken(token)
  }

  /**
   * Update KYC verification status
   */
  async updateKYC(
    db: D1Database,
    input: KYCVerifyInput,
    updateKYCFn: (db: D1Database, userId: string, verified: boolean) => Promise<{ id: string; kycVerified: boolean; kycVerifiedAt: Date | null } | null>
  ): Promise<KYCVerifyResponse> {
    const user = await updateKYCFn(db, input.userId, input.verified)

    if (!user) {
      throw createAuthError('USER_NOT_FOUND')
    }

    return {
      userId: user.id,
      kycVerified: user.kycVerified ?? false,
      kycVerifiedAt: user.kycVerifiedAt ? new Date((user.kycVerifiedAt as number) * 1000) : undefined,
    }
  }

  /**
   * Set or update spending PIN
   */
  async setPin(
    db: D1Database,
    userId: string,
    input: PinSetInput,
    updateUserFn: (db: D1Database, userId: string, data: { pinHash: string; pinSalt: string }) => Promise<void>
  ): Promise<PinResponse> {
    // Hash the PIN (same algorithm as password)
    const hashedPin = await hashPassword(input.pin)

    await updateUserFn(db, userId, {
      pinHash: hashedPin.hash,
      pinSalt: hashedPin.salt,
    })

    return {
      success: true,
      message: 'PIN set successfully',
    }
  }

  /**
   * Verify spending PIN
   */
  async verifyPin(
    db: D1Database,
    userId: string,
    input: PinVerifyInput,
    findUserFn: (db: D1Database, userId: string) => Promise<UserRecord | null>,
    kv?: KVNamespace
  ): Promise<PinResponse> {
    const user = await findUserFn(db, userId)

    if (!user) {
      throw createAuthError('USER_NOT_FOUND')
    }

    if (!user.pinHash) {
      throw createAuthError('PIN_NOT_SET')
    }

    // Check rate limiting in KV if available
    if (kv) {
      const rateLimitKey = `pin:attempts:${userId}`
      const attempts = await kv.get(rateLimitKey)
      const attemptCount = attempts ? parseInt(attempts, 10) : 0

      if (attemptCount >= 3) {
        return {
          success: false,
          message: 'Too many failed attempts. Please try again later.',
        }
      }
    }

    const hashedPin: HashedPassword = {
      hash: user.pinHash,
      salt: user.pinSalt,
      iterations: 100000,
      algorithm: 'PBKDF2-SHA256',
    }

    const isValid = await verifyPassword(input.pin, hashedPin)

    if (!isValid && kv) {
      // Increment failed attempts
      const rateLimitKey = `pin:attempts:${userId}`
      const attempts = await kv.get(rateLimitKey)
      const attemptCount = attempts ? parseInt(attempts, 10) : 0
      await kv.put(rateLimitKey, String(attemptCount + 1), { expirationTtl: 300 })
    }

    if (!isValid) {
      return {
        success: false,
        message: 'Invalid PIN',
      }
    }

    // Clear attempts on success
    if (kv) {
      await kv.delete(`pin:attempts:${userId}`)
    }

    return {
      success: true,
      message: 'PIN verified successfully',
    }
  }

  /**
   * Find user by email or phone
   * This is a helper method that uses a generic query function
   */
  private async findUserByIdentifier(
    db: D1Database,
    identifier: string
  ): Promise<UserRecord | null> {
    const { email, phone } = extractIdentifier(identifier)

    if (email) {
      const result = await db
        .prepare('SELECT * FROM users WHERE email = ? LIMIT 1')
        .bind(email)
        .first()
      return result
    }

    if (phone) {
      const result = await db
        .prepare('SELECT * FROM users WHERE phone = ? LIMIT 1')
        .bind(phone)
        .first()
      return result
    }

    return null
  }

  /**
   * Validate JWT token from Authorization header
   */
  async validateAuthHeader(authHeader: string | null): Promise<JWTPayload | null> {
    if (!authHeader) {
      return null
    }

    // Extract token from "Bearer <token>"
    const match = authHeader.match(/^Bearer\s+(.+)$/)
    if (!match) {
      return null
    }

    const token = match[1]
    return this.verifyToken(token)
  }
}

// Export the auth error creator for use in routes
export { createAuthError }
export type { AuthError }
