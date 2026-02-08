import { Hono } from 'hono'
import type { Env } from '../../index.js'
import { WalletService } from '../../services/wallet.service.js'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth.js'

export const walletRouter = new Hono<{ Bindings: Env }>()

const walletService = new WalletService()

// Validation schema for transaction list query
const transactionListSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().min(0).default(0).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  type: z.enum(['PAYMENT', 'P2P', 'FUND', 'WITHDRAW']).optional(),
})

// Validation schema for funding wallet
const fundWalletSchema = z.object({
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
  amount: z.number().min(1, 'Amount must be at least $0.01'),
  idempotencyKey: z.string().optional(),
})

// Validation schema for withdrawing funds
const withdrawFundsSchema = z.object({
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
  amount: z.number().min(1, 'Amount must be at least $0.01'),
  type: z.enum(['instant', 'standard'], {
    required_error: 'Withdrawal type is required',
  }),
  idempotencyKey: z.string().optional(),
})

// Validation schema for adding card payment method
const cardDetailsSchema = z.object({
  number: z.string().min(13, 'Card number is too short').max(19, 'Card number is too long'),
  expiryMonth: z.number().min(1).max(12),
  expiryYear: z.number().min(new Date().getFullYear()),
  cvv: z.string().length(3, 'CVV must be 3 digits').or(z.string().length(4, 'CVV must be 4 digits')),
  cardholderName: z.string().min(2, 'Cardholder name is required'),
  billingZip: z.string().optional(),
})

// Validation schema for adding bank payment method
const bankDetailsSchema = z.object({
  plaidPublicToken: z.string().min(1, 'Plaid public token is required'),
  accountId: z.string().min(1, 'Account ID is required'),
  accountName: z.string().min(1, 'Account name is required'),
})

// Validation schema for adding payment method
const addPaymentMethodSchema = z.object({
  type: z.enum(['card', 'bank'], {
    required_error: 'Payment method type is required',
  }),
  cardDetails: cardDetailsSchema.optional(),
  bankDetails: bankDetailsSchema.optional(),
  setAsDefault: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.type === 'card' && !data.cardDetails) return false
    if (data.type === 'bank' && !data.bankDetails) return false
    return true
  },
  {
    message: 'Card details required for card type, bank details required for bank type',
  }
)

// GET /api/v1/wallet/balance
walletRouter.get('/balance', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const db = c.env.DB
    const balance = await walletService.getBalance(db, userId)

    return c.json({ balance })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to get balance' },
      500
    )
  }
})

// GET /api/v1/wallet/transactions
walletRouter.get(
  '/transactions',
  authMiddleware,
  zValidator('query', transactionListSchema),
  async (c) => {
    try {
      const userId = c.get('userId')
      const query = c.req.valid('query')

      const db = c.env.DB
      const transactions = await walletService.getTransactions(db, userId, {
        limit: query.limit ?? 20,
        offset: query.offset ?? 0,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        type: query.type,
      })

      return c.json({ transactions })
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : 'Failed to get transactions' },
        500
      )
    }
  }
)

// POST /api/v1/wallet/fund
walletRouter.post(
  '/fund',
  authMiddleware,
  zValidator('json', fundWalletSchema),
  async (c) => {
    try {
      const userId = c.get('userId')
      const body = c.req.valid('json')
      const db = c.env.DB

      // Convert dollars to cents
      const amountInCents = Math.round(body.amount * 100)

      const result = await walletService.fundWallet(db, userId, {
        paymentMethodId: body.paymentMethodId,
        amount: amountInCents,
        idempotencyKey: body.idempotencyKey,
      })

      return c.json(result)
    } catch (error) {
      const statusCode = error instanceof Error && 'statusCode' in error
        ? (error as any).statusCode
        : 500
      return c.json(
        {
          error: error instanceof Error ? error.message : 'Failed to fund wallet',
          code: error instanceof Error && 'code' in error ? (error as any).code : 'FUND_FAILED',
        },
        statusCode
      )
    }
  }
)

// POST /api/v1/wallet/withdraw
walletRouter.post(
  '/withdraw',
  authMiddleware,
  zValidator('json', withdrawFundsSchema),
  async (c) => {
    try {
      const userId = c.get('userId')
      const body = c.req.valid('json')
      const db = c.env.DB

      // Convert dollars to cents
      const amountInCents = Math.round(body.amount * 100)

      const result = await walletService.withdrawFunds(db, userId, {
        paymentMethodId: body.paymentMethodId,
        amount: amountInCents,
        type: body.type,
        idempotencyKey: body.idempotencyKey,
      })

      return c.json(result)
    } catch (error) {
      const statusCode = error instanceof Error && 'statusCode' in error
        ? (error as any).statusCode
        : 500
      return c.json(
        {
          error: error instanceof Error ? error.message : 'Failed to withdraw funds',
          code: error instanceof Error && 'code' in error ? (error as any).code : 'WITHDRAW_FAILED',
        },
        statusCode
      )
    }
  }
)

// POST /api/v1/wallet/funding-sources
walletRouter.post(
  '/funding-sources',
  authMiddleware,
  zValidator('json', addPaymentMethodSchema),
  async (c) => {
    try {
      const userId = c.get('userId')
      const body = c.req.valid('json')
      const db = c.env.DB

      const result = await walletService.addPaymentMethod(db, userId, {
        type: body.type,
        cardDetails: body.cardDetails,
        bankDetails: body.bankDetails,
        setAsDefault: body.setAsDefault,
      })

      return c.json(result, 201)
    } catch (error) {
      const statusCode = error instanceof Error && 'statusCode' in error
        ? (error as any).statusCode
        : 500
      return c.json(
        {
          error: error instanceof Error ? error.message : 'Failed to add payment method',
          code: error instanceof Error && 'code' in error ? (error as any).code : 'ADD_PAYMENT_METHOD_FAILED',
        },
        statusCode
      )
    }
  }
)

// GET /api/v1/wallet/funding-sources
walletRouter.get('/funding-sources', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const db = c.env.DB

    const paymentMethods = await walletService.getPaymentMethods(db, userId)

    return c.json({ paymentMethods })
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get payment methods',
        code: 'GET_PAYMENT_METHODS_FAILED',
      },
      500
    )
  }
})

// DELETE /api/v1/wallet/funding-sources/:id
walletRouter.delete('/funding-sources/:id', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const paymentMethodId = c.req.param('id')
    const db = c.env.DB

    if (!paymentMethodId) {
      return c.json({ error: 'Payment method ID is required' }, 400)
    }

    await walletService.removePaymentMethod(db, userId, paymentMethodId)

    return c.json({ removed: true })
  } catch (error) {
    const statusCode = error instanceof Error && 'statusCode' in error
      ? (error as any).statusCode
      : 500
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to remove payment method',
        code: error instanceof Error && 'code' in error ? (error as any).code : 'REMOVE_PAYMENT_METHOD_FAILED',
      },
      statusCode
    )
  }
})

// PUT /api/v1/wallet/funding-sources/:id/default
walletRouter.put('/funding-sources/:id/default', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const paymentMethodId = c.req.param('id')
    const db = c.env.DB

    if (!paymentMethodId) {
      return c.json({ error: 'Payment method ID is required' }, 400)
    }

    await walletService.setDefaultPaymentMethod(db, userId, paymentMethodId)

    return c.json({ updated: true })
  } catch (error) {
    const statusCode = error instanceof Error && 'statusCode' in error
      ? (error as any).statusCode
      : 500
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to set default payment method',
        code: error instanceof Error && 'code' in error ? (error as any).code : 'SET_DEFAULT_PAYMENT_METHOD_FAILED',
      },
      statusCode
    )
  }
})
