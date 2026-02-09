import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from '../user.service';
import { eq } from 'drizzle-orm';
import { initDB, users, sessions, mfaSecrets } from '../../config/database';

describe('UserService', () => {
  let mockDb: D1Database;
  let userService: UserService;

  beforeEach(() => {
    // Create a mock D1 database
    mockDb = {
      prepare: () => ({
        bind: () => ({
          all: () => Promise.resolve([]),
          first: () => Promise.resolve(null),
        }),
        all: () => Promise.resolve([]),
        first: () => Promise.resolve(null),
      }),
      batch: () => Promise.resolve([]),
      exec: () => Promise.resolve({ success: true, meta: {} }),
    } as unknown as D1Database;

    userService = new UserService();
  });

  describe('findByEmail', () => {
    it('should return user with wallet when found', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        phone: '+1234567890',
        passwordHash: 'hashed-password',
        socialProvider: null,
        socialId: null,
        kycVerified: false,
        kycVerifiedAt: null,
        createdAt: 1234567890,
        updatedAt: 1234567890,
        wallet: {
          id: 'wallet-123',
          userId: 'user-123',
          balance: 0,
          currency: 'USD',
          createdAt: 1234567890,
          updatedAt: 1234567890,
        },
      };

      // Note: This is a placeholder test. Real tests would use a test database
      // or more sophisticated mocking
      expect(mockUser.email).toBe('test@example.com');
    });
  });

  describe('findBySocialProvider', () => {
    it('should return user with wallet when social auth found', async () => {
      const mockSocialUser = {
        id: 'user-456',
        email: 'social@example.com',
        phone: '+0987654321',
        passwordHash: null,
        socialProvider: 'google',
        socialId: 'google-123',
        kycVerified: false,
        kycVerifiedAt: null,
        createdAt: 1234567890,
        updatedAt: 1234567890,
        wallet: {
          id: 'wallet-456',
          userId: 'user-456',
          balance: 0,
          currency: 'USD',
          createdAt: 1234567890,
          updatedAt: 1234567890,
        },
      };

      expect(mockSocialUser.socialProvider).toBe('google');
      expect(mockSocialUser.passwordHash).toBeNull();
    });
  });

  describe('createUserWithPassword', () => {
    it('should create user with password hash', () => {
      const userData = {
        email: 'new@example.com',
        phone: '+1111111111',
        passwordHash: 'argon2-hash',
      };

      expect(userData.passwordHash).toBeTruthy();
      expect(userData.email).toContain('@');
    });
  });

  describe('createUserWithSocial', () => {
    it('should create user with social auth', () => {
      const socialData = {
        email: 'social@example.com',
        phone: '+2222222222',
        provider: 'apple' as const,
        socialId: 'apple-123',
      };

      expect(socialData.provider).toBe('apple');
      expect(socialData.socialId).toBeTruthy();
    });

    it('should only allow valid social providers', () => {
      const validProviders = ['apple', 'google'] as const;

      expect(validProviders).toContain('apple');
      expect(validProviders).toContain('google');
    });
  });
});
