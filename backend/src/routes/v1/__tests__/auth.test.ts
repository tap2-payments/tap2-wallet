/**
 * Authentication API endpoint tests
 *
 * Tests for register, login, logout, refresh, forgot-password, and reset-password endpoints.
 * Includes security testing for timing attacks, rate limiting, and token validation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authRouter } from '../auth.js';
import type { Env } from '../../../index.js';
import { hashPassword } from '../../../lib/password.js';
import { signRefreshToken } from '../../../lib/jwt.js';

// Mock D1 database
const createMockDB = () => {
  const mockData = {
    users: [] as any[],
    sessions: [] as any[],
  };

  return {
    data: mockData,
    mock: {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      execute: vi.fn(),
    },
  };
};

const createMockEnv = (mockDB: ReturnType<typeof createMockDB>): Env => {
  return {
    DB: mockDB.mock as unknown as D1Database,
    KV: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as KVNamespace,
    R2: {} as R2Bucket,
    ENVIRONMENT: 'test',
    JWT_SECRET: 'test-secret-key-for-jwt-signing-min-32-chars',
    JWT_SECRET_V1: 'test-secret-key-v1-for-jwt-signing-min-32',
    JWT_SECRET_V2: 'test-secret-key-v2-for-jwt-signing-min-32',
  };
};

const createTestRequest = (
  url: string,
  method: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): Request => {
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  return new Request(url, init);
};

// Helper to decode JWT payload (without verification for testing)
function decodeJwt(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }
  const payload = parts[1];
  const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
  const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decoded);
}

describe('Authentication API', () => {
  let mockDB: ReturnType<typeof createMockDB>;
  let mockEnv: Env;

  beforeEach(() => {
    mockDB = createMockDB();
    mockEnv = createMockEnv(mockDB);
    vi.clearAllMocks();
  });

  // ==========================================================================
  // POST /v1/auth/register
  // ==========================================================================

  describe('POST /v1/auth/register', () => {
    const validRegisterData = {
      email: 'test@example.com',
      phone: '+1234567890',
      password: 'SecurePassword123!',
    };

    it('should register a new user with valid data', async () => {
      // Mock no existing users
      mockDB.mock.select.mockResolvedValueOnce([]);

      // Mock successful insert
      mockDB.mock.values.mockResolvedValueOnce(undefined);
      mockDB.mock.execute.mockResolvedValueOnce(undefined);

      // Mock session insert
      mockDB.mock.values.mockResolvedValueOnce(undefined);
      mockDB.mock.execute.mockResolvedValueOnce(undefined);

      const request = createTestRequest(
        'http://localhost/api/v1/auth/register',
        'POST',
        validRegisterData
      );

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(201);

      const body = await response.json();
      expect(body).toHaveProperty('user');
      expect(body).toHaveProperty('tokens');
      expect(body.user).toHaveProperty('id');
      expect(body.user).toHaveProperty('email', validRegisterData.email);
      expect(body.user).toHaveProperty('phone', validRegisterData.phone);
      expect(body.tokens).toHaveProperty('accessToken');
      expect(body.tokens).toHaveProperty('refreshToken');
      expect(body.tokens).toHaveProperty('expiresIn', 900);
    });

    it('should return 409 when email already exists', async () => {
      // Mock existing user
      mockDB.mock.select.mockResolvedValueOnce([
        { id: 'existing-id', email: validRegisterData.email },
      ]);

      const request = createTestRequest(
        'http://localhost/api/v1/auth/register',
        'POST',
        validRegisterData
      );

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(409);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'Email already registered');
    });

    it('should return 409 when phone already exists', async () => {
      // Mock no email conflict
      mockDB.mock.select.mockResolvedValueOnce([]);
      // Mock phone conflict
      mockDB.mock.select.mockResolvedValueOnce([
        { id: 'existing-id', phone: validRegisterData.phone },
      ]);

      const request = createTestRequest(
        'http://localhost/api/v1/auth/register',
        'POST',
        validRegisterData
      );

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(409);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'Phone number already registered');
    });

    it('should reject weak passwords', async () => {
      mockDB.mock.select.mockResolvedValue([]);

      const request = createTestRequest('http://localhost/api/v1/auth/register', 'POST', {
        email: 'test@example.com',
        phone: '+1234567890',
        password: 'weak',
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('Password must be at least 12 characters');
    });

    it('should reject common passwords', async () => {
      mockDB.mock.select.mockResolvedValue([]);

      const request = createTestRequest('http://localhost/api/v1/auth/register', 'POST', {
        email: 'test@example.com',
        phone: '+1234567890',
        password: 'password123',
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'Password is too common');
    });

    it('should reject invalid email format', async () => {
      const request = createTestRequest('http://localhost/api/v1/auth/register', 'POST', {
        email: 'not-an-email',
        phone: '+1234567890',
        password: 'SecurePassword123!',
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body).toHaveProperty('error');
    });

    it('should reject invalid phone format', async () => {
      const request = createTestRequest('http://localhost/api/v1/auth/register', 'POST', {
        email: 'test@example.com',
        phone: 'not-a-phone',
        password: 'SecurePassword123!',
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body).toHaveProperty('error');
    });
  });

  // ==========================================================================
  // POST /v1/auth/login
  // ==========================================================================

  describe('POST /v1/auth/login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'SecurePassword123!',
    };

    it('should login with valid credentials', async () => {
      const passwordHash = await hashPassword(validLoginData.password);

      // Mock existing user
      mockDB.mock.select
        // First call: user lookup
        .mockResolvedValueOnce([
          {
            id: 'user-id',
            email: validLoginData.email,
            phone: '+1234567890',
            passwordHash,
            kycVerified: false,
          },
        ])
        // Second call: session lookup
        .mockResolvedValueOnce([]);

      // Mock session insert
      mockDB.mock.values.mockResolvedValueOnce(undefined);
      mockDB.mock.execute.mockResolvedValueOnce(undefined);

      const request = createTestRequest(
        'http://localhost/api/v1/auth/login',
        'POST',
        validLoginData
      );

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('user');
      expect(body).toHaveProperty('tokens');
      expect(body.user).toHaveProperty('id', 'user-id');
      expect(body.user).toHaveProperty('email', validLoginData.email);
      expect(body.tokens).toHaveProperty('accessToken');
      expect(body.tokens).toHaveProperty('refreshToken');
      expect(body.tokens).toHaveProperty('expiresIn', 900);
    });

    it('should return 401 for invalid credentials', async () => {
      const passwordHash = await hashPassword(validLoginData.password);

      // Mock existing user
      mockDB.mock.select.mockResolvedValueOnce([
        {
          id: 'user-id',
          email: validLoginData.email,
          passwordHash,
        },
      ]);

      const request = createTestRequest('http://localhost/api/v1/auth/login', 'POST', {
        email: validLoginData.email,
        password: 'WrongPassword123!',
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should return 401 for non-existent user (timing attack protection)', async () => {
      // Mock no user found
      mockDB.mock.select.mockResolvedValueOnce([]);

      const request = createTestRequest(
        'http://localhost/api/v1/auth/login',
        'POST',
        validLoginData
      );

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should update existing session instead of creating duplicate', async () => {
      const passwordHash = await hashPassword(validLoginData.password);
      const deviceId = 'test-device-id';

      // Mock existing user
      mockDB.mock.select
        // First call: user lookup
        .mockResolvedValueOnce([
          {
            id: 'user-id',
            email: validLoginData.email,
            phone: '+1234567890',
            passwordHash,
            kycVerified: false,
          },
        ])
        // Second call: session lookup - existing session found
        .mockResolvedValueOnce([
          {
            id: 'existing-session-id',
            userId: 'user-id',
            deviceId,
          },
        ]);

      // Mock session update
      mockDB.mock.set.mockResolvedValueOnce(undefined);
      mockDB.mock.execute.mockResolvedValueOnce(undefined);

      const request = createTestRequest('http://localhost/api/v1/auth/login', 'POST', {
        ...validLoginData,
        deviceId,
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(200);
      expect(mockDB.mock.set).toHaveBeenCalled();
    });

    it('should have consistent timing for existing vs non-existing users', async () => {
      const passwordHash = await hashPassword(validLoginData.password);

      // Test with existing user
      mockDB.mock.select
        .mockResolvedValueOnce([
          {
            id: 'user-id',
            email: validLoginData.email,
            passwordHash,
          },
        ])
        .mockResolvedValueOnce([]);

      const request1 = createTestRequest(
        'http://localhost/api/v1/auth/login',
        'POST',
        validLoginData
      );

      const start1 = Date.now();
      await authRouter.request(request1, { env: mockEnv });
      const time1 = Date.now() - start1;

      vi.clearAllMocks();

      // Test with non-existing user
      mockDB.mock.select.mockResolvedValueOnce([]);

      const request2 = createTestRequest(
        'http://localhost/api/v1/auth/login',
        'POST',
        validLoginData
      );

      const start2 = Date.now();
      await authRouter.request(request2, { env: mockEnv });
      const time2 = Date.now() - start2;

      // Timing should be similar (within 200ms tolerance for Argon2)
      // The dummy password verify ensures consistent timing
      expect(Math.abs(time1 - time2)).toBeLessThan(200);
    });
  });

  // ==========================================================================
  // POST /v1/auth/logout
  // ==========================================================================

  describe('POST /v1/auth/logout', () => {
    it('should logout and delete session', async () => {
      const refreshToken = await signRefreshToken(
        {
          sub: 'user-id',
          jti: 'session-id',
          device_id: 'device-id',
        },
        { v1: 'key1', v2: 'key2' }
      );

      // Mock successful delete
      mockDB.mock.execute.mockResolvedValueOnce(undefined);

      const request = createTestRequest('http://localhost/api/v1/auth/logout', 'POST', {
        refreshToken,
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(204);
      expect(mockDB.mock.delete).toHaveBeenCalled();
    });

    it('should return 204 even with invalid token (idempotent)', async () => {
      const request = createTestRequest('http://localhost/api/v1/auth/logout', 'POST', {
        refreshToken: 'invalid-token',
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(204);
    });

    it('should return 400 for missing refreshToken', async () => {
      const request = createTestRequest('http://localhost/api/v1/auth/logout', 'POST', {});

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(400);
    });
  });

  // ==========================================================================
  // POST /v1/auth/refresh
  // ==========================================================================

  describe('POST /v1/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const refreshToken = await signRefreshToken(
        {
          sub: 'user-id',
          jti: 'session-id',
          device_id: 'device-id',
        },
        { v1: 'key1', v2: mockEnv.JWT_SECRET_V2 || '' }
      );

      const refreshTokenHash = await hashPassword(refreshToken);

      // Mock existing session
      mockDB.mock.select.mockResolvedValueOnce([
        {
          id: 'session-id',
          userId: 'user-id',
          deviceId: 'device-id',
          refreshTokenHash,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ]);

      const request = createTestRequest('http://localhost/api/v1/auth/refresh', 'POST', {
        refreshToken,
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('expiresIn', 900);

      // Verify token is valid JWT
      const payload = decodeJwt(body.accessToken);
      expect(payload).toHaveProperty('sub', 'user-id');
      expect(payload).toHaveProperty('iss', 'tap2.wallet');
      expect(payload).toHaveProperty('aud', 'api.tap2.wallet');
    });

    it('should reject invalid refresh token', async () => {
      const request = createTestRequest('http://localhost/api/v1/auth/refresh', 'POST', {
        refreshToken: 'invalid-token',
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'Invalid refresh token');
    });

    it('should reject when session does not exist', async () => {
      const refreshToken = await signRefreshToken(
        {
          sub: 'user-id',
          jti: 'session-id',
          device_id: 'device-id',
        },
        { v1: 'key1', v2: mockEnv.JWT_SECRET_V2 || '' }
      );

      // Mock no session
      mockDB.mock.select.mockResolvedValueOnce([]);

      const request = createTestRequest('http://localhost/api/v1/auth/refresh', 'POST', {
        refreshToken,
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'Invalid or expired refresh token');
    });

    it('should reject expired session', async () => {
      const refreshToken = await signRefreshToken(
        {
          sub: 'user-id',
          jti: 'session-id',
          device_id: 'device-id',
        },
        { v1: 'key1', v2: mockEnv.JWT_SECRET_V2 || '' }
      );

      const refreshTokenHash = await hashPassword(refreshToken);

      // Mock expired session
      mockDB.mock.select.mockResolvedValueOnce([
        {
          id: 'session-id',
          userId: 'user-id',
          deviceId: 'device-id',
          refreshTokenHash,
          expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
        },
      ]);

      const request = createTestRequest('http://localhost/api/v1/auth/refresh', 'POST', {
        refreshToken,
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(401);
    });

    it('should reject when token hash does not match stored hash', async () => {
      const refreshToken = await signRefreshToken(
        {
          sub: 'user-id',
          jti: 'session-id',
          device_id: 'device-id',
        },
        { v1: 'key1', v2: mockEnv.JWT_SECRET_V2 || '' }
      );

      // Use a different hash (not matching the token)
      const differentHash = await hashPassword('different-token-value');

      // Mock session with different hash
      mockDB.mock.select.mockResolvedValueOnce([
        {
          id: 'session-id',
          userId: 'user-id',
          deviceId: 'device-id',
          refreshTokenHash: differentHash,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ]);

      const request = createTestRequest('http://localhost/api/v1/auth/refresh', 'POST', {
        refreshToken,
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'Invalid refresh token');
    });
  });

  // ==========================================================================
  // POST /v1/auth/forgot-password
  // ==========================================================================

  describe('POST /v1/auth/forgot-password', () => {
    it('should return 204 for existing email (prevents enumeration)', async () => {
      // Mock existing user
      mockDB.mock.select.mockResolvedValueOnce([{ id: 'user-id', email: 'test@example.com' }]);

      const request = createTestRequest('http://localhost/api/v1/auth/forgot-password', 'POST', {
        email: 'test@example.com',
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(204);
    });

    it('should return 204 for non-existing email (prevents enumeration)', async () => {
      // Mock no user
      mockDB.mock.select.mockResolvedValueOnce([]);

      const request = createTestRequest('http://localhost/api/v1/auth/forgot-password', 'POST', {
        email: 'nonexistent@example.com',
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(204);
    });

    it('should return 400 for invalid email format', async () => {
      const request = createTestRequest('http://localhost/api/v1/auth/forgot-password', 'POST', {
        email: 'not-an-email',
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(400);
    });
  });

  // ==========================================================================
  // POST /v1/auth/reset-password
  // ==========================================================================

  describe('POST /v1/auth/reset-password', () => {
    it('should validate password strength', async () => {
      const request = createTestRequest('http://localhost/api/v1/auth/reset-password', 'POST', {
        token: 'valid-token',
        password: 'weak',
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toContain('Password must be at least 12 characters');
    });

    it('should reject common passwords', async () => {
      const request = createTestRequest('http://localhost/api/v1/auth/reset-password', 'POST', {
        token: 'valid-token',
        password: 'password123',
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'Password is too common');
    });

    it('should return 501 (not yet implemented)', async () => {
      const request = createTestRequest('http://localhost/api/v1/auth/reset-password', 'POST', {
        token: 'valid-token',
        password: 'SecurePassword123!',
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(501);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'Password reset not yet implemented');
    });
  });

  // ==========================================================================
  // POST /v1/auth/verify-email
  // ==========================================================================

  describe('POST /v1/auth/verify-email', () => {
    it('should return 501 (not yet implemented)', async () => {
      const request = createTestRequest('http://localhost/api/v1/auth/verify-email', 'POST', {
        token: 'valid-token',
      });

      const response = await authRouter.request(request, { env: mockEnv });

      expect(response.status).toBe(501);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'Email verification not yet implemented');
    });
  });

  // ==========================================================================
  // Security Tests
  // ==========================================================================

  describe('Security', () => {
    it('should enforce IP-based rate limiting on login', async () => {
      // Mock KV to track rate limit
      let requestCount = 0;
      (mockEnv.KV as any).get = vi.fn().mockImplementation(async () => {
        if (requestCount < 3) {
          return null;
        }
        return JSON.stringify({ count: 3, resetAt: Date.now() + 300000 });
      });

      (mockEnv.KV as any).put = vi.fn().mockImplementation(async () => {
        requestCount++;
      });

      mockDB.mock.select.mockResolvedValue([]);

      for (let i = 0; i < 4; i++) {
        const request = createTestRequest(
          'http://localhost/api/v1/auth/login',
          'POST',
          {
            email: 'test@example.com',
            password: 'SecurePassword123!',
          },
          { 'CF-Connecting-IP': '1.2.3.4' }
        );

        const response = await authRouter.request(request, { env: mockEnv });

        if (i < 3) {
          expect(response.status).not.toBe(429);
        } else {
          expect(response.status).toBe(429);
        }
      }
    });

    it('should handle multiple rate limiters (IP + email) on login', async () => {
      (mockEnv.KV as any).get = vi.fn().mockResolvedValue(null);
      (mockEnv.KV as any).put = vi.fn().mockResolvedValue(undefined);

      mockDB.mock.select.mockResolvedValue([]);

      const request = createTestRequest(
        'http://localhost/api/v1/auth/login',
        'POST',
        {
          email: 'test@example.com',
          password: 'SecurePassword123!',
        }
      );

      await authRouter.request(request, { env: mockEnv });

      // Both IP and email rate limiters should have been checked
      expect((mockEnv.KV as any).get).toHaveBeenCalled();
    });
  });
});
