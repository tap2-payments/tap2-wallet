import { eq } from 'drizzle-orm';
import { initDB, users, wallets } from '../config/database.js';
import type { User, NewUser, Wallet } from '../config/database.js';

export class UserService {
  async findByEmail(db: D1Database, email: string) {
    const dbClient = initDB(db);
    return await dbClient.query.users.findFirst({
      where: eq(users.email, email),
    });
  }

  async findByPhone(db: D1Database, phone: string) {
    const dbClient = initDB(db);
    return await dbClient.query.users.findFirst({
      where: eq(users.phone, phone),
    });
  }

  async findById(db: D1Database, userId: string) {
    const dbClient = initDB(db);
    return await dbClient.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        wallet: true,
      },
    });
  }

  async createUser(
    db: D1Database,
    data: { email: string; phone: string; passwordHash?: string; socialProvider?: string; socialId?: string }
  ): Promise<User> {
    const dbClient = initDB(db);

    const now = new Date();
    const newUser: NewUser = {
      id: crypto.randomUUID(),
      email: data.email,
      phone: data.phone,
      passwordHash: data.passwordHash,
      socialProvider: data.socialProvider,
      socialId: data.socialId,
      kycVerified: false,
      createdAt: now,
      updatedAt: now,
    };

    await dbClient.insert(users).values(newUser);

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

    return newUser as User;
  }

  async updateKYC(db: D1Database, userId: string, verified: boolean) {
    const dbClient = initDB(db);

    const now = new Date();
    await dbClient
      .update(users)
      .set({
        kycVerified: verified,
        kycVerifiedAt: verified ? now : undefined,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    // Return updated user
    return await dbClient.query.users.findFirst({
      where: eq(users.id, userId),
    });
  }
}
