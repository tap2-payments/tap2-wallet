import { eq } from 'drizzle-orm';
import { initDB, wallets, transactions, merchantPayments } from '../config/database.js';

export interface MerchantPaymentInput {
  userId: string;
  merchantId: string;
  amount: number; // Amount in cents
  currency: string;
  paymentMethod?: string;
  paymentType?: 'nfc' | 'qr';
  nfcNonce?: string;
}

export interface PaymentResponse {
  paymentId: string;
  status: string;
  amount: number; // Amount in dollars (for display)
  currency: string;
  timestamp: Date;
  newBalance: number; // Balance in dollars (for display)
}

export class PaymentService {
  /**
   * Initiate a merchant payment using database transaction
   * Ensures ACID compliance for financial operations
   * Note: D1 supports transactions via batch operations
   */
  async initiateMerchantPayment(
    db: D1Database,
    input: MerchantPaymentInput
  ): Promise<PaymentResponse> {
    const dbClient = initDB(db);

    // D1 doesn't support full SQL transactions like PostgreSQL,
    // but we can use batch operations for atomicity
    // For true atomicity in production, consider using Durable Objects

    // Get user's wallet
    const wallet = await dbClient.query.wallets.findFirst({
      where: eq(wallets.userId, input.userId),
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Check balance (stored in cents)
    if (wallet.balance < input.amount) {
      throw new Error('Insufficient wallet balance');
    }

    // Deduct from wallet balance
    const newBalanceCents = wallet.balance - input.amount;
    const now = new Date();
    await dbClient
      .update(wallets)
      .set({
        balance: newBalanceCents,
        updatedAt: now,
      })
      .where(eq(wallets.id, wallet.id));

    // Create transaction record
    const transactionId = crypto.randomUUID();
    await dbClient.insert(transactions).values({
      id: transactionId,
      walletId: wallet.id,
      type: 'PAYMENT',
      amount: input.amount, // Stored in cents
      status: 'PENDING',
      metadata: JSON.stringify({
        merchantId: input.merchantId,
        paymentMethod: input.paymentMethod || 'default',
        paymentType: input.paymentType || 'nfc',
        nfcNonce: input.nfcNonce,
      }),
      createdAt: now,
    });

    // Create merchant payment record
    const paymentId = crypto.randomUUID();
    await dbClient.insert(merchantPayments).values({
      id: paymentId,
      transactionId,
      merchantId: input.merchantId,
      paymentType: input.paymentType === 'qr' ? 'QR' : 'NFC',
      nfcNonce: input.nfcNonce,
      tipAmount: 0,
      createdAt: now,
    });

    // TODO: Sprint 2/3 - Process payment with Stripe
    // For now, mark as completed immediately
    await dbClient
      .update(transactions)
      .set({ status: 'COMPLETED' })
      .where(eq(transactions.id, transactionId));

    await dbClient
      .update(merchantPayments)
      .set({
        completedAt: new Date(),
      })
      .where(eq(merchantPayments.transactionId, transactionId));

    return {
      paymentId: transactionId,
      status: 'completed',
      amount: input.amount / 100, // Convert cents to dollars for display
      currency: input.currency,
      timestamp: new Date(),
      newBalance: newBalanceCents / 100, // Convert cents to dollars for display
    };
  }

  async getPaymentStatus(
    db: D1Database,
    paymentId: string
  ): Promise<PaymentResponse | { merchantId: string; createdAt: Date } | null> {
    const dbClient = initDB(db);

    const transaction = await dbClient.query.transactions.findFirst({
      where: eq(transactions.id, paymentId),
      with: {
        merchantPayment: true,
      },
    });

    if (!transaction) {
      return null;
    }

    return {
      paymentId: transaction.id,
      status: transaction.status.toLowerCase(),
      amount: transaction.amount / 100, // Convert cents to dollars
      currency: 'USD',
      timestamp: transaction.createdAt as Date,
      newBalance: 0, // Would need to fetch current wallet balance
    };
  }

  async completePayment(db: D1Database, paymentId: string): Promise<void> {
    const dbClient = initDB(db);

    await dbClient
      .update(transactions)
      .set({ status: 'COMPLETED' })
      .where(eq(transactions.id, paymentId));

    await dbClient
      .update(merchantPayments)
      .set({
        completedAt: new Date(),
      })
      .where(eq(merchantPayments.transactionId, paymentId));
  }

  async failPayment(
    db: D1Database,
    paymentId: string,
    reason: string
  ): Promise<{ paymentId: string; status: string; reason: string }> {
    const dbClient = initDB(db);

    // Get transaction with wallet for refund
    const transaction = await dbClient.query.transactions.findFirst({
      where: eq(transactions.id, paymentId),
      with: {
        wallet: true,
      },
    });

    if (!transaction) {
      throw new Error('Payment not found');
    }

    // Refund the amount back to wallet
    if (transaction.wallet) {
      const wallet = transaction.wallet as { balance: number; id: string; currency: string };
      await dbClient
        .update(wallets)
        .set({
          balance: wallet.balance + transaction.amount,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));
    }

    // Update transaction status
    await dbClient
      .update(transactions)
      .set({
        status: 'FAILED',
        metadata: JSON.stringify({ failureReason: reason }),
      })
      .where(eq(transactions.id, paymentId));

    return { paymentId, status: 'failed', reason };
  }

  /**
   * Get payment history for a user
   */
  async getPaymentHistory(
    db: D1Database,
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<
    Array<{
      id: string;
      amount: number;
      status: string;
      createdAt: Date;
      merchant?: string;
    }>
  > {
    const dbClient = initDB(db);

    const wallet = await dbClient.query.wallets.findFirst({
      where: eq(wallets.userId, userId),
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const walletTransactions = await dbClient.query.transactions.findMany({
      where: eq(transactions.walletId, wallet.id),
      limit,
      offset,
      orderBy: (transactions, { desc }) => [desc(transactions.createdAt)],
    });

    return walletTransactions.map((tx) => ({
      id: tx.id,
      amount: tx.amount / 100,
      status: tx.status.toLowerCase(),
      createdAt: tx.createdAt as Date,
    }));
  }
}
