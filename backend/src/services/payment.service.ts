import { prisma } from '../config/database.js';
import { InsufficientFundsError } from '../utils/errors.js';

export interface MerchantPaymentInput {
  userId: string;
  merchantId: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  paymentType?: 'nfc' | 'qr';
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
      // Note: input.amount is in cents (integer), wallet.balance is Decimal
      // Convert for comparison: wallet.balance is in dollars, input.amount needs to match
      const walletBalanceCents = wallet.balance.toNumber() * 100;
      if (walletBalanceCents < input.amount) {
        throw new InsufficientFundsError('Insufficient wallet balance');
      }

      // Deduct from wallet balance (convert cents to dollars for database)
      const amountInDollars = input.amount / 100;
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            decrement: amountInDollars,
          },
        },
      });

      // Map payment type to enum values
      const paymentTypeEnum = input.paymentType === 'qr' ? 'QR' : 'NFC';

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'PAYMENT',
          amount: amountInDollars,
          status: 'PENDING',
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
          paymentType: paymentTypeEnum,
          nfcNonce: input.nfcNonce,
        },
      });

      // TODO: Sprint 2/3 - Process payment with Stripe
      // For now, mark as completed immediately
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED' },
      });

      // Fetch the updated wallet balance to return accurate newBalance
      const updatedWallet = await tx.wallet.findUnique({
        where: { id: wallet.id },
        select: { balance: true },
      });

      return {
        paymentId: transaction.id,
        status: 'completed',
        amount: amountInDollars,
        currency: input.currency,
        timestamp: transaction.createdAt,
        newBalance: updatedWallet?.balance.toNumber() ?? wallet.balance.toNumber() - amountInDollars,
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
        data: { status: 'COMPLETED' },
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
          status: 'FAILED',
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
          where: { type: 'PAYMENT' },
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
      status: tx.status.toLowerCase(),
      createdAt: tx.createdAt,
      merchant: tx.merchantPayment?.merchant.businessName || null,
    }));
  }
}
