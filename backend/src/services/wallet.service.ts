import { prisma } from '../config/database.js';

export class WalletService {
  async getBalance(userId: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    return {
      balance: wallet.balance.toNumber(),
      currency: wallet.currency,
    };
  }

  async getTransactions(
    userId: string,
    limit = 20,
    offset = 0,
    startDate?: Date,
    endDate?: Date,
    type?: string
  ) {
    // Build transaction filter conditions
    const where: { type?: string; createdAt?: { gte?: Date; lte?: Date } } = {};

    // Add filters if provided
    if (type) {
      where.type = type;
    }
    if (startDate) {
      where.createdAt = { gte: startDate };
    }
    if (endDate) {
      where.createdAt = { ...where.createdAt, lte: endDate };
    }

    // Fetch wallet by userId first, then use its actual ID for transactions
    const wallet = await prisma.wallet.findFirst({
      where: { userId },
      select: {
        id: true,
        transactions: {
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        },
      },
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    return wallet.transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount.toNumber(),
      status: tx.status,
      createdAt: tx.createdAt,
      metadata: tx.metadata,
    }));
  }

  async createWallet(userId: string) {
    return await prisma.wallet.create({
      data: {
        userId,
        balance: 0,
        currency: 'USD',
      },
    });
  }
}
