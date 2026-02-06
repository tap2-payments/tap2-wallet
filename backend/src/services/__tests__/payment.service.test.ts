import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentService } from '../payment.service.js';
import { InsufficientFundsError } from '../../utils/errors.js';
import { prisma } from '../../config/database.js';
import type { MerchantPaymentInput } from '../payment.service.js';

// Mock Prisma client
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Vitest mock
vi.mock('../../config/database.js', () => ({
  prisma: {
    $transaction: vi.fn(),
    wallet: {
      findUnique: vi.fn(),
    },
    transaction: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    merchantPayment: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('PaymentService', () => {
  let paymentService: PaymentService;

  beforeEach(() => {
    paymentService = new PaymentService();
    vi.clearAllMocks();
  });

  describe('initiateMerchantPayment', () => {
    const mockWallet = {
      id: 'wallet-123',
      userId: 'user-123',
      balance: { toNumber: () => 100.0 }, // $100 = 10,000 cents
      currency: 'USD',
    };

    const mockTransaction = {
      id: 'txn-123',
      walletId: 'wallet-123',
      type: 'PAYMENT',
      amount: 50.0,
      status: 'COMPLETED',
      createdAt: new Date(),
    };

    it('should successfully process a payment with sufficient balance', async () => {
      const input: MerchantPaymentInput = {
        userId: 'user-123',
        merchantId: 'merchant-123',
        amount: 5000, // $50.00 in cents
        currency: 'USD',
        paymentMethod: 'card',
        paymentType: 'nfc',
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        // Mock the transaction callback
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma transaction mock
        const tx = {
          wallet: {
            findUnique: vi.fn()
              .mockResolvedValueOnce(mockWallet)
              .mockResolvedValueOnce({ balance: { toNumber: () => 50.0 } }),
            update: vi.fn().mockResolvedValue(mockWallet),
          },
          transaction: {
            create: vi.fn().mockResolvedValue(mockTransaction),
            update: vi.fn().mockResolvedValue({ ...mockTransaction, status: 'COMPLETED' }),
          },
          merchantPayment: {
            create: vi.fn().mockResolvedValue({ id: 'mp-123' }),
          },
        } as any;

        return await callback(tx);
      });

      const result = await paymentService.initiateMerchantPayment(input);

      expect(result).toHaveProperty('paymentId');
      expect(result).toHaveProperty('status', 'completed');
      expect(result).toHaveProperty('amount', 50.0);
    });

    it('should throw InsufficientFundsError when balance is too low', async () => {
      const lowBalanceWallet = {
        ...mockWallet,
        balance: { toNumber: () => 10.0 }, // $10 = 1,000 cents
      };

      const input = {
        userId: 'user-123',
        merchantId: 'merchant-123',
        amount: 5000, // $50.00 in cents
        currency: 'USD',
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma transaction mock
        const tx = {
          wallet: {
            findUnique: vi.fn().mockResolvedValue(lowBalanceWallet),
          },
        } as any;

        return await callback(tx);
      });

      await expect(paymentService.initiateMerchantPayment(input)).rejects.toThrow(
        InsufficientFundsError
      );
      await expect(paymentService.initiateMerchantPayment(input)).rejects.toThrow(
        'Insufficient wallet balance'
      );
    });

    it('should throw error when wallet is not found', async () => {
      const input = {
        userId: 'nonexistent-user',
        merchantId: 'merchant-123',
        amount: 1000,
        currency: 'USD',
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma transaction mock
        const tx = {
          wallet: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        } as any;

        return await callback(tx);
      });

      await expect(paymentService.initiateMerchantPayment(input)).rejects.toThrow(
        'Wallet not found'
      );
    });
  });

  describe('getPaymentStatus', () => {
    it('should return payment status for valid payment ID', async () => {
      const mockTransaction = {
        id: 'txn-123',
        status: 'COMPLETED',
        amount: { toNumber: () => 50.0 },
        createdAt: new Date(),
        merchantPayment: {
          merchantId: 'merchant-123',
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma mock
      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(mockTransaction as any);

      const result = await paymentService.getPaymentStatus('txn-123');

      expect(result).toHaveProperty('paymentId', 'txn-123');
      expect(result).toHaveProperty('status', 'COMPLETED');
      expect(result).toHaveProperty('amount', 50.0);
      expect(result).toHaveProperty('merchantId', 'merchant-123');
    });

    it('should throw error for non-existent payment', async () => {
      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null);

      await expect(paymentService.getPaymentStatus('nonexistent')).rejects.toThrow(
        'Payment not found'
      );
    });
  });

  describe('completePayment', () => {
    it('should mark payment as completed', async () => {
      const mockTransaction = {
        id: 'txn-123',
        status: 'PENDING',
        merchantPayment: { id: 'mp-123' },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma transaction mock
        const tx = {
          transaction: {
            findUnique: vi.fn().mockResolvedValue(mockTransaction),
            update: vi.fn().mockResolvedValue({ ...mockTransaction, status: 'COMPLETED' }),
          },
          merchantPayment: {
            update: vi.fn().mockResolvedValue({ completedAt: new Date() }),
          },
        } as any;

        return await callback(tx);
      });

      const result = await paymentService.completePayment('txn-123');

      expect(result).toHaveProperty('status', 'COMPLETED');
    });
  });

  describe('failPayment', () => {
    it('should refund amount and mark payment as failed', async () => {
      const mockTransaction = {
        id: 'txn-123',
        status: 'PENDING',
        walletId: 'wallet-123',
        amount: { toNumber: () => 50.0 },
        wallet: {
          id: 'wallet-123',
          balance: { toNumber: () => 50.0 },
        },
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma transaction mock
        const tx = {
          transaction: {
            findUnique: vi.fn().mockResolvedValue(mockTransaction),
            update: vi.fn().mockResolvedValue({ ...mockTransaction, status: 'FAILED' }),
          },
          wallet: {
            update: vi.fn().mockResolvedValue({ balance: 100.0 }),
          },
        } as any;

        return await callback(tx);
      });

      const result = await paymentService.failPayment('txn-123', 'Insufficient funds');

      expect(result).toHaveProperty('paymentId', 'txn-123');
      expect(result).toHaveProperty('status', 'failed');
      expect(result).toHaveProperty('reason', 'Insufficient funds');
    });
  });
});
