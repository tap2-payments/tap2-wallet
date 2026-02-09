import { eq, desc, and } from 'drizzle-orm';
import { initDB, wallets, transactions } from '../config/database.js';
import type { Wallet } from '../config/database.js';

export interface TransactionListOptions {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  type?: 'PAYMENT' | 'P2P' | 'FUND' | 'WITHDRAW';
}

export interface BalanceResponse {
  balance: number; // In dollars (converted from cents)
  currency: string;
}

export interface TransactionResponse {
  id: string;
  type: string;
  amount: number; // In dollars (converted from cents)
  status: string;
  createdAt: Date;
  metadata: string | null;
}

export class WalletService {
  /**
   * Get wallet balance for a user
   * Balance is stored in cents, returned in dollars
   */
  async getBalance(db: D1Database, userId: string): Promise<BalanceResponse> {
    const dbClient = initDB(db);

    const wallet = await dbClient.query.wallets.findFirst({
      where: eq(wallets.userId, userId),
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Convert cents to dollars
    return {
      balance: wallet.balance / 100,
      currency: wallet.currency,
    };
  }

  /**
   * Get transactions for a user's wallet
   * Amounts are stored in cents, returned in dollars
   */
  async getTransactions(
    db: D1Database,
    userId: string,
    options: TransactionListOptions = {}
  ): Promise<TransactionResponse[]> {
    const dbClient = initDB(db);

    // First get the wallet
    const wallet = await dbClient.query.wallets.findFirst({
      where: eq(wallets.userId, userId),
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Build where conditions
    const conditions: Array<ReturnType<typeof eq>> = [eq(transactions.walletId, wallet.id)];

    if (options.type) {
      conditions.push(eq(transactions.type, options.type));
    }

    if (options.startDate || options.endDate) {
      // Date filtering would need SQL between clause with timestamp comparisons
      // For now, we'll filter in-memory if needed (not ideal for production)
      // TODO: Implement proper SQL date filtering
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Get transactions
    const walletTransactions = await dbClient.query.transactions.findMany({
      where: whereClause,
      orderBy: [desc(transactions.createdAt)],
      limit: options.limit ?? 20,
      offset: options.offset ?? 0,
    });

    return walletTransactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount / 100, // Convert cents to dollars
      status: tx.status,
      createdAt: tx.createdAt as Date, // Drizzle returns Date objects with mode: 'timestamp'
      metadata: tx.metadata,
    }));
  }

  /**
   * Create a new wallet for a user
   */
  async createWallet(db: D1Database, userId: string): Promise<Wallet> {
    const dbClient = initDB(db);

    const now = new Date();
    const newWallet: Wallet = {
      id: crypto.randomUUID(),
      userId,
      balance: 0, // Stored in cents
      currency: 'USD',
      createdAt: now,
      updatedAt: now,
    };

    const result = await dbClient.insert(wallets).values(newWallet).returning();

    return result[0]!;
  }

  /**
   * Update wallet balance
   * @returns The new balance in cents
   */
  async updateBalance(
    db: D1Database,
    walletId: string,
    amountInCents: number,
    operation: 'increment' | 'decrement' = 'increment'
  ): Promise<number> {
    const dbClient = initDB(db);

    // Get current balance
    const wallet = await dbClient.query.wallets.findFirst({
      where: eq(wallets.id, walletId),
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const newBalance =
      operation === 'increment' ? wallet.balance + amountInCents : wallet.balance - amountInCents;

    if (newBalance < 0) {
      throw new Error('Insufficient funds');
    }

    // Update balance
    await dbClient
      .update(wallets)
      .set({
        balance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, walletId));

    return newBalance;
  }
}
