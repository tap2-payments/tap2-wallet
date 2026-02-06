import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WalletService } from '../wallet.service.js';
import { prisma } from '../../config/database.js';

// Mock Prisma client
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Vitest mock
vi.mock('../../config/database.js', () => ({
  prisma: {
    wallet: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('WalletService', () => {
  let walletService: WalletService;

  beforeEach(() => {
    walletService = new WalletService();
    vi.clearAllMocks();
  });

  describe('getBalance', () => {
    it('should return wallet balance for valid user', async () => {
      const mockWallet = {
        id: 'wallet-123',
        userId: 'user-123',
        balance: { toNumber: () => 100.5 },
        currency: 'USD',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma mock
      vi.mocked(prisma.wallet.findUnique).mockResolvedValue(mockWallet as any);

      const result = await walletService.getBalance('user-123');

      expect(result).toEqual({
        balance: 100.5,
        currency: 'USD',
      });
      expect(prisma.wallet.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });

    it('should throw error when wallet not found', async () => {
      vi.mocked(prisma.wallet.findUnique).mockResolvedValue(null);

      await expect(walletService.getBalance('nonexistent')).rejects.toThrow(
        'Wallet not found'
      );
    });
  });

  describe('getTransactions', () => {
    const mockWallet = {
      id: 'wallet-123',
      transactions: [
        {
          id: 'txn-1',
          type: 'PAYMENT',
          amount: { toNumber: () => 50.0 },
          status: 'COMPLETED',
          createdAt: new Date('2024-01-01'),
          metadata: null,
        },
        {
          id: 'txn-2',
          type: 'P2P',
          amount: { toNumber: () => 25.0 },
          status: 'PENDING',
          createdAt: new Date('2024-01-02'),
          metadata: { note: 'Test' },
        },
      ],
    };

    it('should return transactions for valid wallet', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma mock
      vi.mocked(prisma.wallet.findFirst).mockResolvedValue(mockWallet as any);

      const result = await walletService.getTransactions('user-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'txn-1',
        type: 'PAYMENT',
        amount: 50.0,
        status: 'COMPLETED',
        createdAt: new Date('2024-01-01'),
        metadata: null,
      });
    });

    it('should filter transactions by type', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma mock
      vi.mocked(prisma.wallet.findFirst).mockResolvedValue(mockWallet as any);

      const result = await walletService.getTransactions('user-123', 20, 0, undefined, undefined, 'PAYMENT');

      expect(prisma.wallet.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        select: {
          id: true,
          transactions: {
            where: { type: 'PAYMENT' },
            orderBy: { createdAt: 'desc' },
            take: 20,
            skip: 0,
          },
        },
      });
    });

    it('should apply date range filters', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma mock
      vi.mocked(prisma.wallet.findFirst).mockResolvedValue(mockWallet as any);

      await walletService.getTransactions('user-123', 20, 0, startDate, endDate);

      expect(prisma.wallet.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        select: {
          id: true,
          transactions: {
            where: {
              createdAt: { gte: startDate, lte: endDate },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
            skip: 0,
          },
        },
      });
    });

    it('should throw error when wallet not found', async () => {
      vi.mocked(prisma.wallet.findFirst).mockResolvedValue(null);

      await expect(walletService.getTransactions('nonexistent')).rejects.toThrow(
        'Wallet not found'
      );
    });
  });

  describe('createWallet', () => {
    it('should create a new wallet', async () => {
      const mockWallet = {
        id: 'wallet-123',
        userId: 'user-123',
        balance: 0,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma mock
      vi.mocked(prisma.wallet.create).mockResolvedValue(mockWallet as any);

      const result = await walletService.createWallet('user-123');

      expect(result).toEqual(mockWallet);
      expect(prisma.wallet.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          balance: 0,
          currency: 'USD',
        },
      });
    });
  });
});
