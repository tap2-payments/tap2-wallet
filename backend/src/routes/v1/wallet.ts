import { Hono } from 'hono';
import type { Env } from '../../index.js';
import { WalletService } from '../../services/wallet.service.js';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const walletRouter = new Hono<{ Bindings: Env }>();

const walletService = new WalletService();

// Validation schema for transaction list query
const transactionListSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().min(0).default(0).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  type: z.enum(['PAYMENT', 'P2P', 'FUND', 'WITHDRAW']).optional(),
});

// GET /api/v1/wallet/balance
walletRouter.get('/balance', async (c) => {
  try {
    // TODO: Get userId from auth middleware
    const userId = c.req.header('x-user-id') || 'demo-user';

    const db = c.env.DB;
    const balance = await walletService.getBalance(db, userId);

    return c.json({ balance });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to get balance' }, 500);
  }
});

// GET /api/v1/wallet/transactions
walletRouter.get('/transactions', zValidator('query', transactionListSchema), async (c) => {
  try {
    // TODO: Get userId from auth middleware
    const userId = c.req.header('x-user-id') || 'demo-user';
    const query = c.req.valid('query');

    const db = c.env.DB;
    const transactions = await walletService.getTransactions(db, userId, {
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      type: query.type,
    });

    return c.json({ transactions });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to get transactions' },
      500
    );
  }
});
