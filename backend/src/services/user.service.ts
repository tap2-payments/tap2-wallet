import { eq, and } from 'drizzle-orm';
import { initDB, users, wallets } from '../config/database.js';
import type { User, NewUser, Wallet } from '../config/database.js';

export class UserService {
  async findByEmail(db: D1Database, email: string) {
    const dbClient = initDB(db);
    return await dbClient.query.users.findFirst({
      where: eq(users.email, email),
      with: {
        wallet: true,
      },
    });
  }

  async findByPhone(db: D1Database, phone: string) {
    const dbClient = initDB(db);
    return await dbClient.query.users.findFirst({
      where: eq(users.phone, phone),
      with: {
        wallet: true,
      },
    });
  }

  /**
   * Find a user by their social provider and provider ID
   * @param db - D1 database instance
   * @param provider - Social provider ('apple' or 'google')
   * @param socialId - Provider's user ID
   * @returns User with wallet or null
   */
  async findBySocialProvider(
    db: D1Database,
    provider: 'apple' | 'google',
    socialId: string
  ) {
    const dbClient = initDB(db);
    return await dbClient.query.users.findFirst({
      where: and(eq(users.socialProvider, provider), eq(users.socialId, socialId)),
      with: {
        wallet: true,
      },
    });
  }

  /**
   * Create a new user with password authentication
   * @param db - D1 database instance
   * @param data - User data (passwordHash is Argon2id hash)
   * @returns Created user
   */
  async createUserWithPassword(
    db: D1Database,
    data: { email: string; phone: string; passwordHash: string }
  ): Promise<User> {
    const dbClient = initDB(db);

    const now = new Date();
    const newUser: NewUser = {
      id: crypto.randomUUID(),
      email: data.email,
      phone: data.phone,
      passwordHash: data.passwordHash,
      socialProvider: null,
      socialId: null,
      kycVerified: false,
      createdAt: now,
      updatedAt: now,
    };

    const result = await dbClient.insert(users).values(newUser).returning();

    // Create wallet for new user
    const newWallet: Wallet = {
      id: crypto.randomUUID(),
      userId: newUser.id,
      balance: 0, // Stored in cents
      currency: 'USD',
      createdAt: now,
      updatedAt: now,
    };

    await dbClient.insert(wallets).values(newWallet);

    return result[0]!;
  }

  /**
   * Create a new user with social authentication
   * @param db - D1 database instance
   * @param data - User data from social provider
   * @returns Created user
   */
  async createUserWithSocial(
    db: D1Database,
    data: {
      email: string;
      phone: string;
      provider: 'apple' | 'google';
      socialId: string;
    }
  ): Promise<User> {
    const dbClient = initDB(db);

    const now = new Date();
    const newUser: NewUser = {
      id: crypto.randomUUID(),
      email: data.email,
      phone: data.phone,
      passwordHash: null,
      socialProvider: data.provider,
      socialId: data.socialId,
      kycVerified: false,
      createdAt: now,
      updatedAt: now,
    };

    const result = await dbClient.insert(users).values(newUser).returning();

    // Create wallet for new user
    const newWallet: Wallet = {
      id: crypto.randomUUID(),
      userId: newUser.id,
      balance: 0, // Stored in cents
      currency: 'USD',
      createdAt: now,
      updatedAt: now,
    };

    await dbClient.insert(wallets).values(newWallet);

    return result[0]!;
  }

  /**
   * Update user's KYC verification status
   * @param db - D1 database instance
   * @param userId - User ID
   * @param verified - KYC verification status
   * @returns Updated user
   */
  async updateKYC(db: D1Database, userId: string, verified: boolean) {
    const dbClient = initDB(db);

    const now = new Date();
    await dbClient
      .update(users)
      .set({
        kycVerified: verified,
        kycVerifiedAt: verified ? now : null,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    // Return updated user
    return await dbClient.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        wallet: true,
      },
    });
  }
}
