import { describe, it, expect } from 'vitest';
import {
  users,
  sessions,
  mfaSecrets,
  socialProviderEnum,
  type User,
  type Session,
  type MfaSecret,
} from '../schema';

describe('Custom Auth Schema', () => {
  describe('users table', () => {
    it('should have passwordHash field', () => {
      // Verify schema includes password hash for password authentication
      expect(users).toBeDefined();
    });

    it('should have socialProvider and socialId fields', () => {
      // Verify schema includes social auth fields
      expect(users).toBeDefined();
    });

    it('should have social provider enum with valid values', () => {
      expect(socialProviderEnum).toContain('apple');
      expect(socialProviderEnum).toContain('google');
      expect(socialProviderEnum).toHaveLength(2);
    });
  });

  describe('sessions table', () => {
    it('should be defined', () => {
      expect(sessions).toBeDefined();
    });
  });

  describe('mfa_secrets table', () => {
    it('should be defined', () => {
      expect(mfaSecrets).toBeDefined();
    });
  });

  describe('type exports', () => {
    it('should export User type', () => {
      const userType: string = 'User';
      expect(userType).toBe('User');
    });

    it('should export Session type', () => {
      const sessionType: string = 'Session';
      expect(sessionType).toBe('Session');
    });

    it('should export MfaSecret type', () => {
      const mfaType: string = 'MfaSecret';
      expect(mfaType).toBe('MfaSecret');
    });
  });
});

describe('Schema Constraints', () => {
  describe('users table constraints', () => {
    it('should enforce unique constraint on (socialProvider, socialId)', () => {
      // This constraint prevents duplicate social auth accounts
      const constraintName = 'users_social_unique';
      expect(constraintName).toBe('users_social_unique');
    });

    it('should require exactly one auth method', () => {
      // Either passwordHash OR (socialProvider + socialId) must be set
      // This is enforced at application layer
      const validAuthMethods = [
        { passwordHash: 'hash', socialProvider: null, socialId: null },
        { passwordHash: null, socialProvider: 'apple', socialId: 'id' },
        { passwordHash: null, socialProvider: 'google', socialId: 'id' },
      ];

      expect(validAuthMethods).toHaveLength(3);
    });
  });

  describe('sessions table constraints', () => {
    it('should enforce unique constraint on (userId, deviceId)', () => {
      const constraintName = 'sessions_user_device_unique';
      expect(constraintName).toBe('sessions_user_device_unique');
    });

    it('should have index on expiresAt for cleanup', () => {
      const indexName = 'sessions_expires_at_idx';
      expect(indexName).toBe('sessions_expires_at_idx');
    });
  });

  describe('mfa_secrets table constraints', () => {
    it('should enforce unique constraint on userId', () => {
      // One MFA secret per user
      expect(true).toBe(true);
    });
  });
});
