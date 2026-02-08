import { Hono } from 'hono'
import type { Env, Context } from '../../index.js'
import { PaymentService, PaymentError } from '../../services/payment.service.js'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth.js'

export const paymentsRouter = new Hono<{ Bindings: Env }>()

const paymentService = new PaymentService()

// ==================== Validation Schemas ====================

const merchantPaymentSchema = z.object({
  merchantId: z.string().min(1, 'Merchant ID is required'),
  amount: z.number().positive('Amount must be positive'), // Amount in cents
  currency: z.string().default('USD'),
  paymentMethodId: z.string().optional(),
  paymentType: z.enum(['nfc', 'qr']).default('nfc'),
  nfcNonce: z.string().optional(),
  qrCodeId: z.string().optional(),
  tipAmount: z.number().int().min(0).optional(),
  idempotencyKey: z.string().optional(),
})

const p2pTransferSchema = z.object({
  recipientId: z.string().min(1, 'Recipient ID is required'),
  amount: z.number().positive('Amount must be positive'), // Amount in cents
  paymentMethodId: z.string().optional(),
  note: z.string().max(500).optional(),
  idempotencyKey: z.string().optional(),
})

const qrPaymentSchema = z.object({
  qrData: z.string().min(1, 'QR data is required'),
  idempotencyKey: z.string().optional(),
})

const refundSchema = z.object({
  reason: z.string().max(500).optional(),
  partialAmount: z.number().positive().optional(), // Partial refund amount in cents
})

// ==================== Helper Functions ====================

/**
 * Get user ID from request context (set by auth middleware)
 */
function getUserIdFromContext(c: Context<{ Bindings: Env }>): string {
  const userId = c.get('userId')
  if (!userId) {
    throw new Error('User not authenticated')
  }
  return userId
}

/**
 * Convert PaymentError to appropriate HTTP response
 */
function handlePaymentError(error: unknown): Response {
  if (error instanceof PaymentError) {
    return new Response(
      JSON.stringify({
        error: error.message,
        code: error.code,
      }),
      {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Handle unexpected errors
  console.error('Unexpected payment error:', error)
  return new Response(
    JSON.stringify({
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

// ==================== P2P Transfer ====================

/**
 * POST /api/v1/payments/p2p
 * Initiate a P2P money transfer
 *
 * @example
 * POST /api/v1/payments/p2p
 * {
 *   "recipientId": "user-123",
 *   "amount": 1000, // $10.00 in cents
 *   "note": "Thanks for dinner!"
 * }
 */
paymentsRouter.post('/p2p', authMiddleware, zValidator('json', p2pTransferSchema), async (c) => {
  try {
    const senderId = getUserIdFromContext(c)
    const transferData = c.req.valid('json')
    const db = c.env.DB

    const result = await paymentService.processP2PTransfer(
      db,
      {
        senderId,
        recipientId: transferData.recipientId,
        amount: transferData.amount,
        paymentMethodId: transferData.paymentMethodId,
        note: transferData.note,
      },
      transferData.idempotencyKey
    )

    return c.json(result, 201)
  } catch (error) {
    return handlePaymentError(error)
  }
})

// ==================== Merchant Payment ====================

/**
 * POST /api/v1/payments/merchant
 * Process a merchant payment (NFC or QR)
 *
 * @example
 * POST /api/v1/payments/merchant
 * {
 *   "merchantId": "merchant-123",
 *   "amount": 2500, // $25.00 in cents
 *   "paymentType": "nfc",
 *   "tipAmount": 500 // $5.00 tip in cents
 * }
 */
paymentsRouter.post('/merchant', authMiddleware, zValidator('json', merchantPaymentSchema), async (c) => {
  try {
    const userId = getUserIdFromContext(c)
    const paymentData = c.req.valid('json')
    const db = c.env.DB

    const result = await paymentService.processMerchantPayment(
      db,
      {
        userId,
        merchantId: paymentData.merchantId,
        amount: paymentData.amount,
        currency: paymentData.currency || 'USD',
        paymentMethodId: paymentData.paymentMethodId,
        paymentType: paymentData.paymentType || 'nfc',
        nfcNonce: paymentData.nfcNonce,
        qrCodeId: paymentData.qrCodeId,
        tipAmount: paymentData.tipAmount,
      },
      paymentData.idempotencyKey
    )

    return c.json(result, 201)
  } catch (error) {
    return handlePaymentError(error)
  }
})

// ==================== QR Code Payment ====================

/**
 * POST /api/v1/payments/qr
 * Process a QR code payment
 * Parses QR data and processes the payment
 *
 * QR Data Format:
 * {
 *   "merchantId": "merchant-123",
 *   "amount": 2500,
 *   "expiresAt": 1738362000,
 *   "nonce": "abc123"
 * }
 *
 * @example
 * POST /api/v1/payments/qr
 * {
 *   "qrData": "eyJtZXJjaGFudElkIjoibWVyY2hhbnQtMTIzIiwiYW1vdW50IjoyNTAwfQ=="
 * }
 */
paymentsRouter.post('/qr', authMiddleware, zValidator('json', qrPaymentSchema), async (c) => {
  try {
    const userId = getUserIdFromContext(c)
    const { qrData, idempotencyKey } = c.req.valid('json')
    const db = c.env.DB

    // Parse QR data - it may be base64 encoded or JSON
    let parsedQrData: Record<string, unknown>
    try {
      // Try base64 decoding first
      const decoded = atob(qrData)
      try {
        parsedQrData = JSON.parse(decoded)
      } catch {
        // If not JSON, use the decoded string directly
        parsedQrData = { raw: decoded }
      }
    } catch {
      // If base64 fails, try parsing as JSON directly
      try {
        parsedQrData = JSON.parse(qrData)
      } catch {
        // If JSON fails, treat as raw data
        parsedQrData = { raw: qrData }
      }
    }

    // Validate QR code structure
    if (!parsedQrData.merchantId) {
      return c.json({ error: 'Invalid QR code: missing merchantId', code: 'INVALID_QR' }, 400)
    }

    // Check if QR code has expired
    const now = Math.floor(Date.now() / 1000)
    if (parsedQrData.expiresAt && parsedQrData.expiresAt < now) {
      return c.json({ error: 'QR code has expired', code: 'QR_EXPIRED' }, 400)
    }

    // Process the payment
    const result = await paymentService.processMerchantPayment(
      db,
      {
        userId,
        merchantId: parsedQrData.merchantId,
        amount: parsedQrData.amount || 0, // Amount may come from QR or be entered by user
        currency: 'USD',
        paymentType: 'qr',
        qrCodeId: JSON.stringify({ ...parsedQrData, scannedAt: now }),
        nfcNonce: parsedQrData.nonce,
      },
      idempotencyKey
    )

    return c.json(result, 201)
  } catch (error) {
    return handlePaymentError(error)
  }
})

// ==================== Payment Status ====================

/**
 * GET /api/v1/payments/:id/status
 * Get payment status by ID
 *
 * @example
 * GET /api/v1/payments/abc-123/status
 */
paymentsRouter.get('/:id/status', async (c) => {
  try {
    const paymentId = c.req.param('id')
    const db = c.env.DB

    const status = await paymentService.getPaymentStatus(db, paymentId)

    return c.json(status)
  } catch (error) {
    return handlePaymentError(error)
  }
})

// ==================== Refund Payment ====================

/**
 * POST /api/v1/payments/:id/refund
 * Refund a payment (full or partial)
 *
 * @example
 * POST /api/v1/payments/abc-123/refund
 * {
 *   "reason": "Customer requested refund"
 * }
 *
 * @example Partial refund
 * POST /api/v1/payments/abc-123/refund
 * {
 *   "reason": "Partial refund for returned item",
 *   "partialAmount": 1000 // $10.00 in cents
 * }
 */
paymentsRouter.post('/:id/refund', zValidator('json', refundSchema), async (c) => {
  try {
    const paymentId = c.req.param('id')
    const refundData = c.req.valid('json')
    const db = c.env.DB

    const result = await paymentService.refundPayment(
      db,
      paymentId,
      refundData.reason,
      refundData.partialAmount
    )

    return c.json(result, 200)
  } catch (error) {
    return handlePaymentError(error)
  }
})

// ==================== Payment History ====================

/**
 * GET /api/v1/payments/history
 * Get payment history for the authenticated user
 *
 * @example
 * GET /api/v1/payments/history?limit=20&offset=0
 */
paymentsRouter.get('/history', authMiddleware, async (c) => {
  try {
    const userId = getUserIdFromContext(c)
    const db = c.env.DB

    const limit = Number(c.req.query('limit')) || 20
    const offset = Number(c.req.query('offset')) || 0

    // Validate limit
    const validLimit = Math.min(Math.max(limit, 1), 100)
    const validOffset = Math.max(offset, 0)

    const history = await paymentService.getPaymentHistory(db, userId, validLimit, validOffset)

    return c.json({
      payments: history,
      pagination: {
        limit: validLimit,
        offset: validOffset,
        count: history.length,
      },
    })
  } catch (error) {
    return handlePaymentError(error)
  }
})

// ==================== Fee Calculation ====================

/**
 * GET /api/v1/payments/fee
 * Calculate fee for a payment amount
 *
 * @example
 * GET /api/v1/payments/fee?amount=10000&type=instant_cashout
 */
paymentsRouter.get('/fee', async (c) => {
  try {
    const amount = Number(c.req.query('amount'))
    const type = (c.req.query('type') as 'instant_cashout' | 'p2p' | 'merchant') || 'instant_cashout'

    if (isNaN(amount) || amount <= 0) {
      return c.json({ error: 'Invalid amount', code: 'INVALID_AMOUNT' }, 400)
    }

    const feeCents = paymentService.calculateFee(amount, type)

    return c.json({
      amount: amount / 100, // Original amount in dollars
      fee: feeCents / 100, // Fee in dollars
      total: (amount + feeCents) / 100, // Total in dollars
      feePercentage: type === 'instant_cashout' ? 1.5 : 0,
      type,
    })
  } catch (error) {
    return handlePaymentError(error)
  }
})

// ==================== NFC Payment Initiation ====================

/**
 * POST /api/v1/payments/nfc/initiate
 * Initiate NFC payment handshake
 * This endpoint is called when devices are tapped together
 *
 * @example
 * POST /api/v1/payments/nfc/initiate
 * {
 *   "nonce": "abc123",
 *   "merchantId": "merchant-123"
 * }
 */
paymentsRouter.post('/nfc/initiate', zValidator('json', z.object({
  nonce: z.string().min(1),
  merchantId: z.string().optional(),
})), async (c) => {
  try {
    const { nonce, merchantId } = c.req.valid('json')

    // Generate a unique payment session ID
    const sessionId = crypto.randomUUID()
    const expiresAt = Math.floor(Date.now() / 1000) + 300 // 5 minute expiry

    // TODO: In production, store session in KV or Durable Object
    // for stateful NFC handshake

    return c.json({
      sessionId,
      status: 'initiated',
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      message: 'NFC payment session initiated. Complete the payment within 5 minutes.',
      nonce,
      merchantId,
    })
  } catch (error) {
    return handlePaymentError(error)
  }
})

// ==================== Generate QR Code ====================

/**
 * POST /api/v1/payments/qr/generate
 * Generate a QR code for receiving payments
 * Can be used by merchants or users for P2P
 *
 * @example
 * POST /api/v1/payments/qr/generate
 * {
 *   "amount": 2500, // Optional amount
 *   "expiresIn": 300 // Expiry in seconds (default 300)
 * }
 */
paymentsRouter.post('/qr/generate', authMiddleware, zValidator('json', z.object({
  amount: z.number().positive().optional(),
  expiresIn: z.number().int().positive().default(300),
})), async (c) => {
  try {
    const userId = getUserIdFromContext(c)
    const { amount, expiresIn } = c.req.valid('json')

    const now = Math.floor(Date.now() / 1000)
    const expiresAt = now + expiresIn
    const qrId = crypto.randomUUID()

    // Create QR data payload
    const qrData = {
      qrId,
      userId,
      amount: amount || 0,
      expiresAt,
      generatedAt: now,
    }

    // Encode as base64 for compact QR code
    const encodedQrData = btoa(JSON.stringify(qrData))

    return c.json({
      qrId,
      qrData: encodedQrData,
      amount,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      url: `tap2wallet://pay?data=${encodedQrData}`,
    })
  } catch (error) {
    return handlePaymentError(error)
  }
})
