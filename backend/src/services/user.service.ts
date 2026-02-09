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

  async findByAuth0Id(db: D1Database, auth0Id: string) {
    const dbClient = initDB(db);
    return await dbClient.query.users.findFirst({
      where: eq(users.auth0Id, auth0Id),
      with: {
        wallet: true,
      },
    });
  }

  async createUser(
    db: D1Database,
    data: { email: string; phone: string; auth0Id?: string }
  ): Promise<User> {
    const dbClient = initDB(db);

    const now = new Date();
    const newUser: NewUser = {
      id: crypto.randomUUID(),
      email: data.email,
      phone: data.phone,
      auth0Id: data.auth0Id,
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
    });
  }
}
