/**
 * JWT token management utilities
 *
 * Implements access and refresh tokens with key versioning for rotation support.
 * Uses the jose library for Cloudflare Workers compatibility.
 *
 * @see https://github.com/panva/jose
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

/**
 * JWT secret key versions for rotation
 *
 * Environment variables should be set as:
 * - JWT_SECRET_v2 (current signing key)
 * - JWT_SECRET_v1 (previous key for verification during rotation)
 */
interface JwtSecrets {
  v1: string;
  v2: string;
}

/**
 * Current active key version for signing
 */
const CURRENT_VERSION = 'v2';

/**
 * Access token payload structure
 */
export interface AccessTokenPayload extends JWTPayload {
  /** User ID (subject) */
  sub: string;
  /** Issuer */
  iss: string;
  /** Audience */
  aud: string;
  /** JWT ID (token identifier) */
  jti: string;
}

/**
 * Refresh token payload structure
 */
export interface RefreshTokenPayload extends JWTPayload {
  /** User ID (subject) */
  sub: string;
  /** Session ID */
  jti: string;
  /** Device identifier */
  device_id: string;
}

/**
 * Token verification result with typed payload
 */
export interface TokenVerificationResult<T extends JWTPayload> {
  payload: T;
  protectedHeader: { alg: string; kid?: string };
}

/**
 * Get JWT secrets from environment
 * Throws if current secret is not configured
 */
function getSecrets(env: { JWT_SECRET?: string; JWT_SECRET_V1?: string; JWT_SECRET_V2?: string }): JwtSecrets {
  const v1 = env.JWT_SECRET_V1 || env.JWT_SECRET || '';
  const v2 = env.JWT_SECRET_V2 || env.JWT_SECRET || '';

  if (!v2) {
    throw new Error('JWT_SECRET_V2 or JWT_SECRET environment variable must be set');
  }

  return { v1, v2 };
}

/**
 * Get a secret key by version
 */
function getSecretByVersion(secrets: JwtSecrets, version?: string): string {
  if (!version) {
    return secrets[CURRENT_VERSION];
  }

  const key = secrets[version as keyof JwtSecrets];
  if (!key) {
    throw new Error(`Unknown JWT key version: ${version}`);
  }

  return key;
}

/**
 * Sign an access token
 *
 * Access tokens are short-lived (15 minutes) and used for API requests.
 *
 * @param payload - Token payload including user ID
 * @param secrets - JWT secrets object
 * @param options - Optional issuer and audience overrides
 * @returns Signed JWT string
 *
 * @example
 * ```ts
 * const token = await signAccessToken(
 *   { sub: userId, jti: tokenId, iss: 'tap2.wallet', aud: 'api.tap2.wallet' },
 *   secrets
 * );
 * ```
 */
export async function signAccessToken(
  payload: Omit<AccessTokenPayload, 'iat' | 'exp'>,
  secrets: JwtSecrets,
  options: { issuer?: string; audience?: string } = {}
): Promise<string> {
  const { issuer = 'tap2.wallet', audience = 'api.tap2.wallet' } = options;

  return await new SignJWT({ ...payload, iss: issuer, aud: audience })
    .setProtectedHeader({ alg: 'HS256', kid: CURRENT_VERSION, typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(secrets[CURRENT_VERSION]));
}

/**
 * Sign a refresh token
 *
 * Refresh tokens are long-lived (30 days) and used to obtain new access tokens.
 *
 * @param payload - Token payload including user ID and session ID
 * @param secrets - JWT secrets object
 * @returns Signed JWT string
 */
export async function signRefreshToken(
  payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>,
  secrets: JwtSecrets
): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', kid: CURRENT_VERSION, typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(new TextEncoder().encode(secrets[CURRENT_VERSION]));
}

/**
 * Verify an access token
 *
 * Supports key versioning for graceful secret rotation.
 * Will try to verify with any known key version.
 *
 * @param token - JWT string to verify
 * @param env - Environment variables containing secrets
 * @returns Verification result with typed payload
 * @throws If token is invalid, expired, or from unknown key version
 */
export async function verifyAccessToken(
  token: string,
  env: { JWT_SECRET?: string; JWT_SECRET_V1?: string; JWT_SECRET_V2?: string }
): Promise<TokenVerificationResult<AccessTokenPayload>> {
  const secrets = getSecrets(env);

  // Decode header to get key version
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));

  // Reject tokens without key version header
  if (!header.kid) {
    throw new Error('Token missing key version identifier (kid header)');
  }

  const keyVersion = header.kid as string;
  const secret = getSecretByVersion(secrets, keyVersion);

  const result = await jwtVerify(token, new TextEncoder().encode(secret), {
    issuer: 'tap2.wallet',
    audience: 'api.tap2.wallet',
  });

  return {
    payload: result.payload as AccessTokenPayload,
    protectedHeader: result.protectedHeader as { alg: string; kid: string },
  };
}

/**
 * Verify a refresh token
 *
 * @param token - JWT string to verify
 * @param env - Environment variables containing secrets
 * @returns Verification result with typed payload
 * @throws If token is invalid, expired, or from unknown key version
 */
export async function verifyRefreshToken(
  token: string,
  env: { JWT_SECRET?: string; JWT_SECRET_V1?: string; JWT_SECRET_V2?: string }
): Promise<TokenVerificationResult<RefreshTokenPayload>> {
  const secrets = getSecrets(env);

  // Decode header to get key version
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));

  // Reject tokens without key version header
  if (!header.kid) {
    throw new Error('Token missing key version identifier (kid header)');
  }

  const keyVersion = header.kid as string;
  const secret = getSecretByVersion(secrets, keyVersion);

  const result = await jwtVerify(token, new TextEncoder().encode(secret), {
    issuer: 'tap2.wallet',
  });

  return {
    payload: result.payload as RefreshTokenPayload,
    protectedHeader: result.protectedHeader as { alg: string; kid: string },
  };
}

/**
 * Base64URL decode (replaces atob with proper Uint8Array conversion)
 */
function base64UrlDecode(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a unique token ID (jti)
 *
 * @returns Random UUID v4
 */
export function generateTokenId(): string {
  return crypto.randomUUID();
}

/**
 * Calculate token expiration time in seconds
 *
 * @param minutes - Minutes until expiration
 * @returns Unix timestamp in seconds
 */
export function getExpirationTime(minutes: number): number {
  return Math.floor(Date.now() / 1000) + minutes * 60;
}
