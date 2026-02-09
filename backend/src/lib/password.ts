/**
 * Password hashing and verification utilities using Argon2id
 *
 * Why Argon2id?
 * - Memory-hard, resistant to GPU/ASIC attacks
 * - Winner of Password Hashing Competition 2015
 * - Recommended by OWASP for new implementations
 *
 * @see https://www.rfc-editor.org/rfc/rfc9106.html
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 */

import { argon2idAsync } from '@noble/hashes/argon2.js';
import { randomBytes } from '@noble/hashes/utils.js';

/**
 * Argon2id parameters balanced for edge compute (~100ms)
 * Based on OWASP recommendations for 2024
 */
const ARGON2ID_PARAMS = {
  /** Time cost (iterations) - OWASP recommends minimum 2 */
  t: 3,
  /** Memory cost in KiB - OWASP recommends minimum 64 MB (65536 KiB) */
  m: 65536,
  /** Parallelism - suitable for multi-core edge workers */
  p: 4,
  /** Output length in bytes (256 bits) */
  dkLen: 32,
} as const;

/**
 * Salt length in bytes (128 bits)
 */
const SALT_LENGTH = 16;

/**
 * Format for storing hashed passwords
 * Format: $argon2id$v=$t,m=$m,p=$p$salt$hash
 * All values are hex-encoded
 */
const HASH_FORMAT_REGEX =
  /^\$argon2id\$v=\d+,m=\d+,p=\d+\$[a-f0-9]+\$[a-f0-9]+$/;

/**
 * Generate a cryptographically secure random salt
 */
function generateSalt(): Uint8Array {
  return randomBytes(SALT_LENGTH);
}

/**
 * Convert Uint8Array to hex string
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 */
function fromHex(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []);
}

/**
 * Hash a password using Argon2id
 *
 * @param password - The plain text password to hash
 * @returns A formatted hash string containing parameters, salt, and hash
 *
 * @example
 * ```ts
 * const hash = await hashPassword('secure-password');
 * // Returns: "$argon2id$v=3,m=65536,p=4$a1b2c3d4...$e5f6g7h8..."
 * ```
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 12) {
    throw new Error('Password must be at least 12 characters long');
  }

  const salt = generateSalt();
  const hash = await argon2idAsync(password, salt, ARGON2ID_PARAMS);

  // Format: $argon2id$v=$t,m=$m,p=$p$salt$hash
  const formatted = `$argon2id$v=${ARGON2ID_PARAMS.t},m=${ARGON2ID_PARAMS.m},p=${ARGON2ID_PARAMS.p}$${toHex(salt)}$${toHex(hash)}`;

  return formatted;
}

/**
 * Verify a password against a stored hash
 *
 * @param password - The plain text password to verify
 * @param hashedPassword - The stored hash string to compare against
 * @returns true if the password matches, false otherwise
 *
 * @example
 * ```ts
 * const valid = await verifyPassword('user-input', storedHash);
 * if (valid) {
 *   // Password is correct
 * }
 * ```
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  // Validate hash format
  if (!HASH_FORMAT_REGEX.test(hashedPassword)) {
    throw new Error('Invalid hash format');
  }

  try {
    // Parse the stored hash
    const parts = hashedPassword.split('$');
    const params = parts[3].split(',');
    const t = parseInt(params[0].split('=')[1], 10);
    const m = parseInt(params[1].split('=')[1], 10);
    const p = parseInt(params[2].split('=')[1], 10);
    const salt = fromHex(parts[4]);
    const storedHash = fromHex(parts[5]);

    // Hash the provided password with the same parameters and salt
    const computedHash = await argon2idAsync(password, salt, { t, m, p, dkLen: ARGON2ID_PARAMS.dkLen });

    // Constant-time comparison to prevent timing attacks
    if (computedHash.length !== storedHash.length) {
      return false;
    }

    return constantTimeEqual(computedHash, storedHash);
  } catch {
    return false;
  }
}

/**
 * Constant-time comparison to prevent timing attacks
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

/**
 * Validate password strength
 *
 * Requirements:
 * - Minimum 12 characters
 * - At least 3 of: uppercase, lowercase, number, symbol
 *
 * @param password - The password to validate
 * @returns An object with valid flag and optional error message
 */
export function validatePasswordStrength(
  password: string
): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters long' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password must not exceed 128 characters' };
  }

  // Count character types
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  const typeCount = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;

  if (typeCount < 3) {
    return {
      valid: false,
      error: 'Password must contain at least 3 of: uppercase, lowercase, number, symbol',
    };
  }

  return { valid: true };
}

/**
 * Common passwords that should be rejected
 * In production, this would integrate with haveibeenpwned API
 */
const COMMON_PASSWORDS = new Set([
  'password123',
  '1234567890',
  'qwerty1234',
  'abc123456789',
  'letmein123',
  'welcome123',
  'monkey1234',
  'dragon1234',
  'master1234',
  'hello123456',
]);

/**
 * Check if a password is too common
 *
 * @param password - The password to check
 * @returns true if the password is common and should be rejected
 */
export function isCommonPassword(password: string): boolean {
  const normalized = password.toLowerCase();
  return COMMON_PASSWORDS.has(normalized);
}
