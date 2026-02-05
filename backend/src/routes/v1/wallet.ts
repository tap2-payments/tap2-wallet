import { Router } from 'express';
import { WalletService } from '../../services/wallet.service.js';
import { transactionListSchema, validateQuery } from '../../utils/validation.js';

export const walletRouter = Router();
const walletService = new WalletService();

// GET /api/v1/wallet/balance
walletRouter.get('/balance', async (req, res) => {
  try {
    // User is attached by authentication middleware
    const userId = req.user!.id;

    const balance = await walletService.getBalance(userId);
    res.json({ balance });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch balance'
    });
  }
});

// GET /api/v1/wallet/transactions
walletRouter.get('/transactions', validateQuery(transactionListSchema), async (req, res) => {
  try {
    const userId = req.user!.id;
    const { limit, offset, startDate, endDate, type } = req.query as any;

    const transactions = await walletService.getTransactions(
      userId,
      Number(limit),
      Number(offset),
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      type as string | undefined
    );

    res.json({ transactions });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch transactions'
    });
  }
});

