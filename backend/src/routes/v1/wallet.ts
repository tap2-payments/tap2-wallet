import { Router, type Response, type NextFunction } from 'express';
import { WalletService } from '../../services/wallet.service.js';
import { transactionListSchema, validateQuery } from '../../utils/validation.js';
import type { TransactionListInput } from '../../utils/validation.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';

export const walletRouter = Router();
const walletService = new WalletService();

// GET /api/v1/wallet/balance
walletRouter.get('/balance', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // User is attached by authentication middleware
    const userId = req.user.id;

    const balance = await walletService.getBalance(userId);
    res.json({ balance });
  } catch (error) {
    next(error); // Pass to error handler middleware
  }
});

// GET /api/v1/wallet/transactions
walletRouter.get('/transactions', validateQuery(transactionListSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const { limit, offset, startDate, endDate, type } = req.query as TransactionListInput;

    const transactions = await walletService.getTransactions(
      userId,
      limit,
      offset,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      type
    );

    res.json({ transactions });
  } catch (error) {
    next(error); // Pass to error handler middleware
  }
});

