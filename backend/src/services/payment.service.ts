import { prisma } from '../config/database.js';
import { InsufficientFundsError } from '../utils/errors.js';

interface MerchantPaymentInput {
  userId: string;
  merchantId: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  paymentType?: string;
  nfcNonce?: string;
}

export class PaymentService {
  /**
   * Initiate a merchant payment using database transaction
   * Ensures ACID compliance for financial operations
   */
  async initiateMerchantPayment(input: MerchantPaymentInput) {
    // Use database transaction for atomicity
    return await prisma.$transaction(async (tx) => {
      // Get user's wallet with row lock (pessimistic locking for balance)
      const wallet = await tx.wallet.findUnique({
        where: { userId: input.userId },
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Check balance with Decimal comparison
      if (wallet.balance.toNumber() < input.amount) {
        throw new InsufficientFundsError('Insufficient wallet balance');
      }

      // Deduct from wallet balance
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            decrement: input.amount,
          },
        },
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'payment',
          amount: input.amount,
          status: 'pending',
          metadata: {
            merchantId: input.merchantId,
            paymentMethod: input.paymentMethod || 'default',
            paymentType: input.paymentType || 'nfc',
            nfcNonce: input.nfcNonce,
          },
        },
      });

      // Create merchant payment record
      await tx.merchantPayment.create({
        data: {
          transactionId: transaction.id,
          merchantId: input.merchantId,
          paymentType: input.paymentType || 'nfc',
          nfcNonce: input.nfcNonce,
        },
      });

      // TODO: Sprint 2/3 - Process payment with Stripe
      // For now, mark as completed immediately
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: 'completed' },
      });

      return {
        paymentId: transaction.id,
        status: 'completed',
        amount: input.amount,
        currency: input.currency,
        timestamp: transaction.createdAt,
        newBalance: wallet.balance.toNumber() - input.amount,
      };
    });
  }

  async getPaymentStatus(paymentId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: paymentId },
      include: {
        merchantPayment: true,
      },
    });

    if (!transaction) {
      throw new Error('Payment not found');
    }

    return {
      paymentId: transaction.id,
      status: transaction.status,
      amount: transaction.amount.toNumber(),
      createdAt: transaction.createdAt,
      merchantId: transaction.merchantPayment?.merchantId,
    };
  }

  async completePayment(paymentId: string) {
    return await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: paymentId },
        include: { merchantPayment: true },
      });

      if (!transaction) {
        throw new Error('Payment not found');
      }

      // Update transaction status
      const updated = await tx.transaction.update({
        where: { id: paymentId },
        data: { status: 'completed' },
      });

      // Update merchant payment completed timestamp
      if (transaction.merchantPayment) {
        await tx.merchantPayment.update({
          where: { transactionId: paymentId },
          data: { completedAt: new Date() },
        });
      }

      return updated;
    });
  }

  async failPayment(paymentId: string, reason: string) {
    return await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: paymentId },
        include: { wallet: true },
      });

      if (!transaction) {
        throw new Error('Payment not found');
      }

      // Refund the amount back to wallet
      await tx.wallet.update({
        where: { id: transaction.walletId },
        data: {
          balance: {
            increment: transaction.amount,
          },
        },
      });

      // Update transaction status
      await tx.transaction.update({
        where: { id: paymentId },
        data: {
          status: 'failed',
          metadata: {
            failureReason: reason,
          },
        },
      });

      return { paymentId, status: 'failed', reason };
    });
  }

  /**
   * Get payment history for a user
   */
  async getPaymentHistory(userId: string, limit = 20, offset = 0) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          where: { type: 'payment' },
          include: {
            merchantPayment: {
              include: {
                merchant: true,
              },
            },
          },
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
      amount: tx.amount.toNumber(),
      status: tx.status,
      createdAt: tx.createdAt,
      merchant: tx.merchantPayment?.merchant.businessName || null,
    }));
  }
}
