import { eq, and, lt } from 'drizzle-orm'
import { initDB, wallets, transactions, merchantPayments, p2pTransfers, paymentMethods, users, merchants } from '../config/database.js'
import { RewardsService } from './rewards.service.js'
import type {
  MerchantPayment as MerchantPaymentSchema,
  P2PTransfer as P2PTransferSchema,
  PaymentMethod as PaymentMethodSchema,
} from '../config/database.js'

// ==================== Types ====================

export interface MerchantPaymentInput {
  userId: string
  merchantId: string
  amount: number // Amount in cents
  currency: string
  paymentMethodId?: string
  paymentType?: 'nfc' | 'qr'
  nfcNonce?: string
  qrCodeId?: string
  tipAmount?: number // In cents
}

export interface P2PTransferInput {
  senderId: string
  recipientId: string
  amount: number // Amount in cents
  paymentMethodId?: string
  note?: string
}

export interface PaymentResponse {
  paymentId: string
  status: string
  amount: number // Amount in dollars (for display)
  currency: string
  timestamp: Date
  newBalance: number // Balance in dollars (for display)
  fee?: number // Fee in dollars (for display)
}

export interface P2PTransferResponse {
  transferId: string
  transactionId: string
  status: string
  amount: number // Amount in dollars (for display)
  currency: string
  senderBalance: number // Balance in dollars (for display)
  recipientNote?: string
  expiresAt: Date
}

export interface PaymentStatusResponse {
  paymentId: string
  type: 'merchant' | 'p2p'
  status: string
  amount: number // Amount in dollars
  currency: string
  createdAt: Date
  completedAt?: Date
  metadata?: Record<string, unknown>
}

export interface RefundResponse {
  refundId: string
  originalPaymentId: string
  amount: number // Amount in dollars (for display)
  status: string
  refundedAt: Date
}

// ==================== Custom Errors ====================

export class PaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'PaymentError'
  }
}

export class InsufficientFundsError extends PaymentError {
  constructor(currentBalance: number, requiredAmount: number) {
    super(
      `Insufficient funds. Current balance: $${(currentBalance / 100).toFixed(2)}, Required: $${(requiredAmount / 100).toFixed(2)}`,
      'INSUFFICIENT_FUNDS',
      400
    )
    this.name = 'InsufficientFundsError'
  }
}

export class InvalidPaymentMethodError extends PaymentError {
  constructor(methodId: string) {
    super(`Invalid or inactive payment method: ${methodId}`, 'INVALID_PAYMENT_METHOD', 400)
    this.name = 'InvalidPaymentMethodError'
  }
}

export class ExpiredQRCodeError extends PaymentError {
  constructor() {
    super('QR code has expired', 'QR_EXPIRED', 400)
    this.name = 'ExpiredQRCodeError'
  }
}

export class PaymentNotFoundError extends PaymentError {
  constructor(paymentId: string) {
    super(`Payment not found: ${paymentId}`, 'PAYMENT_NOT_FOUND', 404)
    this.name = 'PaymentNotFoundError'
  }
}

export class UserNotFoundError extends PaymentError {
  constructor(userId: string) {
    super(`User not found: ${userId}`, 'USER_NOT_FOUND', 404)
    this.name = 'UserNotFoundError'
  }
}

export class MerchantNotFoundError extends PaymentError {
  constructor(merchantId: string) {
    super(`Merchant not found: ${merchantId}`, 'MERCHANT_NOT_FOUND', 404)
    this.name = 'MerchantNotFoundError'
  }
}

export class WalletNotFoundError extends PaymentError {
  constructor(userId: string) {
    super(`Wallet not found for user: ${userId}`, 'WALLET_NOT_FOUND', 404)
    this.name = 'WalletNotFoundError'
  }
}

// ==================== Payment Service ====================

export class PaymentService {
  private rewardsService: RewardsService

  constructor() {
    this.rewardsService = new RewardsService()
  }

  // ==================== Fee Calculation ====================

  /**
   * Calculate fee for payment operations
   * @param amountInCents - Amount in cents
   * @param type - Fee type (default: 'instant_cashout' at 1.5%)
   * @returns Fee in cents
   */
  calculateFee(amountInCents: number, type: 'instant_cashout' | 'p2p' | 'merchant' = 'instant_cashout'): number {
    if (type === 'instant_cashout') {
      // 1.5% fee for instant cashout
      return Math.ceil(amountInCents * 0.015)
    }
    // P2P and merchant payments are free
    return 0
  }

  // ==================== Payment Method Validation ====================

  /**
   * Validate payment method before use
   * @throws InvalidPaymentMethodError if payment method is invalid or inactive
   */
  async validatePaymentMethod(
    db: D1Database,
    userId: string,
    paymentMethodId?: string
  ): Promise<PaymentMethodSchema | null> {
    // If no payment method specified, default to wallet balance
    if (!paymentMethodId) {
      return null
    }

    const dbClient = initDB(db)

    const paymentMethod = await dbClient.query.paymentMethods.findFirst({
      where: eq(paymentMethods.id, paymentMethodId),
    })

    if (!paymentMethod) {
      throw new InvalidPaymentMethodError(paymentMethodId)
    }

    if (paymentMethod.userId !== userId) {
      throw new PaymentError('Payment method does not belong to user', 'FORBIDDEN', 403)
    }

    if (!paymentMethod.isActive) {
      throw new InvalidPaymentMethodError(paymentMethodId)
    }

    // Check card expiry if applicable
    if (paymentMethod.type === 'card' && paymentMethod.expiryMonth && paymentMethod.expiryYear) {
      const now = new Date()
      const expiryDate = new Date(paymentMethod.expiryYear, paymentMethod.expiryMonth - 1)
      if (expiryDate < now) {
        throw new PaymentError('Card has expired', 'CARD_EXPIRED', 400)
      }
    }

    return paymentMethod
  }

  // ==================== Transaction Creation Helper ====================

  /**
   * Create a transaction record
   * @returns The created transaction ID
   */
  async createTransaction(
    db: D1Database,
    input: {
      walletId: string
      type: 'PAYMENT' | 'P2P' | 'FUND' | 'WITHDRAW'
      amount: number // In cents
      status: 'PENDING' | 'COMPLETED' | 'FAILED'
      referenceId?: string
      metadata?: Record<string, unknown>
    }
  ): Promise<string> {
    const dbClient = initDB(db)
    const transactionId = crypto.randomUUID()

    await dbClient.insert(transactions).values({
      id: transactionId,
      walletId: input.walletId,
      type: input.type,
      amount: input.amount,
      status: input.status,
      referenceId: input.referenceId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      createdAt: Math.floor(Date.now() / 1000),
    })

    return transactionId
  }

  // ==================== Merchant Payments ====================

  /**
   * Process a merchant payment (NFC or QR)
   * Implements idempotency via idempotencyKey
   */
  async processMerchantPayment(
    db: D1Database,
    input: MerchantPaymentInput,
    idempotencyKey?: string
  ): Promise<PaymentResponse> {
    const dbClient = initDB(db)

    // Check idempotency key if provided
    if (idempotencyKey) {
      const existingPayment = await dbClient.query.transactions.findFirst({
        where: eq(transactions.referenceId, idempotencyKey),
      })
      if (existingPayment) {
        // Return existing payment
        const wallet = await dbClient.query.wallets.findFirst({
          where: eq(wallets.id, existingPayment.walletId),
        })
        return {
          paymentId: existingPayment.id,
          status: existingPayment.status.toLowerCase(),
          amount: existingPayment.amount / 100,
          currency: 'USD',
          timestamp: new Date((existingPayment.createdAt as number) * 1000),
          newBalance: wallet ? wallet.balance / 100 : 0,
        }
      }
    }

    // Verify user exists
    const user = await dbClient.query.users.findFirst({
      where: eq(users.id, input.userId),
    })
    if (!user) {
      throw new UserNotFoundError(input.userId)
    }

    // Verify merchant exists and is active
    const merchant = await dbClient.query.merchants.findFirst({
      where: eq(merchants.id, input.merchantId),
    })
    if (!merchant || !merchant.isActive) {
      throw new MerchantNotFoundError(input.merchantId)
    }

    // Validate payment method if specified
    await this.validatePaymentMethod(db, input.userId, input.paymentMethodId)

    // Get user's wallet
    const wallet = await dbClient.query.wallets.findFirst({
      where: eq(wallets.userId, input.userId),
    })

    if (!wallet) {
      throw new WalletNotFoundError(input.userId)
    }

    // Calculate total amount including tip
    const tipAmount = input.tipAmount || 0
    const totalAmount = input.amount + tipAmount

    // Check balance (stored in cents)
    if (wallet.balance < totalAmount) {
      throw new InsufficientFundsError(wallet.balance, totalAmount)
    }

    const now = Math.floor(Date.now() / 1000)

    // For QR payments, check if QR code has expired (5 minute expiry)
    if (input.paymentType === 'qr' && input.qrCodeId) {
      // In a real implementation, you would check the QR code's creation time
      // For now, we assume QR codes are valid for 5 minutes
      const qrData = JSON.parse(input.qrCodeId)
      if (qrData.expiresAt && qrData.expiresAt < now) {
        throw new ExpiredQRCodeError()
      }
    }

    // Deduct from wallet balance
    const newBalanceCents = wallet.balance - totalAmount
    await dbClient
      .update(wallets)
      .set({
        balance: newBalanceCents,
        updatedAt: now,
      })
      .where(eq(wallets.id, wallet.id))

    // Create transaction record
    const transactionId = await this.createTransaction(db, {
      walletId: wallet.id,
      type: 'PAYMENT',
      amount: totalAmount,
      status: 'COMPLETED',
      referenceId: idempotencyKey,
      metadata: {
        merchantId: input.merchantId,
        merchantName: merchant.businessName,
        paymentMethodId: input.paymentMethodId,
        paymentType: input.paymentType || 'nfc',
        nfcNonce: input.nfcNonce,
        qrCodeId: input.qrCodeId,
        tipAmount,
      },
    })

    // Create merchant payment record
    const merchantPaymentId = crypto.randomUUID()
    await dbClient.insert(merchantPayments).values({
      id: merchantPaymentId,
      transactionId,
      merchantId: input.merchantId,
      paymentMethodId: input.paymentMethodId,
      paymentType: (input.paymentType || 'nfc').toUpperCase() as 'NFC' | 'QR',
      qrCodeId: input.qrCodeId,
      nfcNonce: input.nfcNonce,
      tipAmount,
      completedAt: now,
      createdAt: now,
    })

    // Auto-award rewards points for the transaction
    // Points are earned on the base amount (excluding tips)
    try {
      await this.rewardsService.processTransactionRewards(
        db,
        input.userId,
        transactionId,
        input.amount, // Base amount only, not including tips
        input.merchantId
      )
    } catch (error) {
      // Log error but don't fail the payment if rewards fail
      console.error('Failed to award rewards points:', error)
    }

    return {
      paymentId: transactionId,
      status: 'completed',
      amount: totalAmount / 100, // Convert cents to dollars for display
      currency: input.currency || 'USD',
      timestamp: new Date(now * 1000),
      newBalance: newBalanceCents / 100, // Convert cents to dollars for display
    }
  }

  // ==================== P2P Transfers ====================

  /**
   * Process a P2P transfer between users
   * Includes 24-hour expiry for the recipient to claim
   */
  async processP2PTransfer(
    db: D1Database,
    input: P2PTransferInput,
    idempotencyKey?: string
  ): Promise<P2PTransferResponse> {
    const dbClient = initDB(db)

    // Check idempotency key if provided
    if (idempotencyKey) {
      const existingTransfer = await dbClient.query.transactions.findFirst({
        where: eq(transactions.referenceId, idempotencyKey),
      })
      if (existingTransfer) {
        const p2pTransfer = await dbClient.query.p2pTransfers.findFirst({
          where: eq(p2pTransfers.transactionId, existingTransfer.id),
        })
        return {
          transferId: p2pTransfer?.id || '',
          transactionId: existingTransfer.id,
          status: existingTransfer.status.toLowerCase(),
          amount: existingTransfer.amount / 100,
          currency: 'USD',
          senderBalance: 0, // Would need to fetch current balance
          expiresAt: p2pTransfer ? new Date((p2pTransfer.expiresAt as number) * 1000) : new Date(),
        }
      }
    }

    // Verify both users exist
    const [sender, recipient] = await Promise.all([
      dbClient.query.users.findFirst({ where: eq(users.id, input.senderId) }),
      dbClient.query.users.findFirst({ where: eq(users.id, input.recipientId) }),
    ])

    if (!sender) {
      throw new UserNotFoundError(input.senderId)
    }
    if (!recipient) {
      throw new UserNotFoundError(input.recipientId)
    }

    // Cannot send to yourself
    if (input.senderId === input.recipientId) {
      throw new PaymentError('Cannot send money to yourself', 'SELF_TRANSFER forbidden', 400)
    }

    // Validate payment method if specified
    await this.validatePaymentMethod(db, input.senderId, input.paymentMethodId)

    // Get sender's wallet
    const senderWallet = await dbClient.query.wallets.findFirst({
      where: eq(wallets.userId, input.senderId),
    })

    if (!senderWallet) {
      throw new WalletNotFoundError(input.senderId)
    }

    // Check sender's balance
    if (senderWallet.balance < input.amount) {
      throw new InsufficientFundsError(senderWallet.balance, input.amount)
    }

    // Calculate fee (P2P is free, but method exists for future changes)
    const fee = this.calculateFee(input.amount, 'p2p')
    const totalAmount = input.amount + fee

    const now = Math.floor(Date.now() / 1000)
    const expiresAt = now + 24 * 60 * 60 // 24 hours from now

    // Deduct from sender's wallet
    const newSenderBalance = senderWallet.balance - totalAmount
    await dbClient
      .update(wallets)
      .set({
        balance: newSenderBalance,
        updatedAt: now,
      })
      .where(eq(wallets.id, senderWallet.id))

    // Create transaction record for sender
    const transactionId = await this.createTransaction(db, {
      walletId: senderWallet.id,
      type: 'P2P',
      amount: totalAmount,
      status: 'COMPLETED',
      referenceId: idempotencyKey,
      metadata: {
        senderId: input.senderId,
        recipientId: input.recipientId,
        recipientEmail: recipient.email,
        note: input.note,
        fee,
      },
    })

    // Create P2P transfer record
    const transferId = crypto.randomUUID()
    await dbClient.insert(p2pTransfers).values({
      id: transferId,
      transactionId,
      senderId: input.senderId,
      recipientId: input.recipientId,
      amount: input.amount,
      status: 'COMPLETED',
      expiresAt,
      completedAt: now,
      createdAt: now,
    })

    // Get or create recipient's wallet and credit the amount
    let recipientWallet = await dbClient.query.wallets.findFirst({
      where: eq(wallets.userId, input.recipientId),
    })

    if (!recipientWallet) {
      // Create wallet for recipient if it doesn't exist
      const newWalletId = crypto.randomUUID()
      await dbClient.insert(wallets).values({
        id: newWalletId,
        userId: input.recipientId,
        balance: input.amount,
        currency: 'USD',
        createdAt: now,
        updatedAt: now,
      })
      recipientWallet = {
        id: newWalletId,
        userId: input.recipientId,
        balance: input.amount,
        currency: 'USD',
        createdAt: now,
        updatedAt: now,
      }
    } else {
      // Credit recipient's wallet
      const newRecipientBalance = recipientWallet.balance + input.amount
      await dbClient
        .update(wallets)
        .set({
          balance: newRecipientBalance,
          updatedAt: now,
        })
        .where(eq(wallets.id, recipientWallet.id))
      recipientWallet.balance = newRecipientBalance
    }

    // Create transaction record for recipient
    await this.createTransaction(db, {
      walletId: recipientWallet.id,
      type: 'P2P',
      amount: input.amount,
      status: 'COMPLETED',
      referenceId: `received-${transactionId}`,
      metadata: {
        senderId: input.senderId,
        senderEmail: sender.email,
        note: input.note,
        originalTransactionId: transactionId,
      },
    })

    return {
      transferId,
      transactionId,
      status: 'completed',
      amount: input.amount / 100, // Convert cents to dollars for display
      currency: 'USD',
      senderBalance: newSenderBalance / 100, // Convert cents to dollars for display
      recipientNote: input.note,
      expiresAt: new Date(expiresAt * 1000),
    }
  }

  // ==================== Payment Status ====================

  /**
   * Get payment status by ID
   * Works for both merchant payments and P2P transfers
   */
  async getPaymentStatus(db: D1Database, paymentId: string): Promise<PaymentStatusResponse> {
    const dbClient = initDB(db)

    const transaction = await dbClient.query.transactions.findFirst({
      where: eq(transactions.id, paymentId),
    })

    if (!transaction) {
      throw new PaymentNotFoundError(paymentId)
    }

    // Determine if this is a merchant payment or P2P transfer
    let type: 'merchant' | 'p2p' = 'merchant'
    let metadata: Record<string, unknown> = {}

    if (transaction.type === 'PAYMENT') {
      const merchantPayment = await dbClient.query.merchantPayments.findFirst({
        where: eq(merchantPayments.transactionId, transaction.id),
        with: {
          merchant: true,
        },
      })
      type = 'merchant'
      metadata = {
        merchantId: merchantPayment?.merchantId,
        merchantName: merchantPayment?.merchant?.businessName,
        paymentType: merchantPayment?.paymentType,
        tipAmount: merchantPayment?.tipAmount,
      }
    } else if (transaction.type === 'P2P') {
      const p2pTransfer = await dbClient.query.p2pTransfers.findFirst({
        where: eq(p2pTransfers.transactionId, transaction.id),
      })
      type = 'p2p'
      metadata = {
        senderId: p2pTransfer?.senderId,
        recipientId: p2pTransfer?.recipientId,
        expiresAt: p2pTransfer?.expiresAt,
      }
    }

    // Parse metadata from transaction
    if (transaction.metadata) {
      try {
        const parsedMetadata = JSON.parse(transaction.metadata)
        metadata = { ...metadata, ...parsedMetadata }
      } catch {
        // Ignore parse errors
      }
    }

    return {
      paymentId: transaction.id,
      type,
      status: transaction.status.toLowerCase(),
      amount: transaction.amount / 100, // Convert cents to dollars
      currency: 'USD',
      createdAt: new Date((transaction.createdAt as number) * 1000),
      completedAt: transaction.metadata
        ? new Date((transaction.createdAt as number) * 1000) // Approximate
        : undefined,
      metadata,
    }
  }

  // ==================== Refunds ====================

  /**
   * Process a refund for a payment
   * Only completed payments can be refunded
   */
  async refundPayment(
    db: D1Database,
    paymentId: string,
    reason?: string,
    partialAmountCents?: number
  ): Promise<RefundResponse> {
    const dbClient = initDB(db)

    const transaction = await dbClient.query.transactions.findFirst({
      where: eq(transactions.id, paymentId),
      with: {
        wallet: true,
      },
    })

    if (!transaction) {
      throw new PaymentNotFoundError(paymentId)
    }

    if (transaction.status !== 'COMPLETED') {
      throw new PaymentError('Only completed payments can be refunded', 'INVALID_PAYMENT_STATUS', 400)
    }

    // For merchant payments, check if already refunded
    if (transaction.type === 'PAYMENT') {
      const merchantPayment = await dbClient.query.merchantPayments.findFirst({
        where: eq(merchantPayments.transactionId, paymentId),
      })

      if (merchantPayment?.refundedAt) {
        throw new PaymentError('Payment has already been refunded', 'ALREADY_REFUNDED', 400)
      }
    }

    // Determine refund amount
    const refundAmount = partialAmountCents ?? transaction.amount

    if (refundAmount > transaction.amount) {
      throw new PaymentError('Refund amount cannot exceed original payment amount', 'INVALID_REFUND_AMOUNT', 400)
    }

    const now = Math.floor(Date.now() / 1000)
    const refundId = crypto.randomUUID()

    // Refund to wallet
    if (transaction.wallet) {
      const newBalance = transaction.wallet.balance + refundAmount
      await dbClient
        .update(wallets)
        .set({
          balance: newBalance,
          updatedAt: now,
        })
        .where(eq(wallets.id, transaction.wallet.id))

      // Create refund transaction
      await this.createTransaction(db, {
        walletId: transaction.wallet.id,
        type: 'PAYMENT', // Using PAYMENT type for refunds
        amount: refundAmount,
        status: 'COMPLETED',
        referenceId: `refund-${paymentId}`,
        metadata: {
          refundId,
          originalPaymentId: paymentId,
          reason,
          partialRefund: partialAmountCents !== undefined,
        },
      })
    }

    // Update merchant payment if applicable
    if (transaction.type === 'PAYMENT') {
      await dbClient
        .update(merchantPayments)
        .set({
          refundedAt: now,
        })
        .where(eq(merchantPayments.transactionId, paymentId))
    }

    return {
      refundId,
      originalPaymentId: paymentId,
      amount: refundAmount / 100, // Convert cents to dollars for display
      status: 'completed',
      refundedAt: new Date(now * 1000),
    }
  }

  // ==================== Expired Transfers Cleanup ====================

  /**
   * Cancel expired P2P transfers (to be run by a scheduled job)
   * This is a utility method for maintenance
   */
  async cancelExpiredTransfers(db: D1Database): Promise<number> {
    const dbClient = initDB(db)
    const now = Math.floor(Date.now() / 1000)

    // Find expired transfers that are still pending
    const expiredTransfers = await dbClient.query.p2pTransfers.findMany({
      where: and(
        eq(p2pTransfers.status, 'PENDING'),
        lt(p2pTransfers.expiresAt, now)
      ),
    })

    let cancelledCount = 0

    for (const transfer of expiredTransfers) {
      // Get the transaction
      const transaction = await dbClient.query.transactions.findFirst({
        where: eq(transactions.id, transfer.transactionId),
        with: {
          wallet: true,
        },
      })

      if (transaction && transaction.wallet) {
        // Refund the amount back to sender's wallet
        const newBalance = transaction.wallet.balance + transfer.amount
        await dbClient
          .update(wallets)
          .set({
            balance: newBalance,
            updatedAt: now,
          })
          .where(eq(wallets.id, transaction.wallet.id))

        // Update transfer status
        await dbClient
          .update(p2pTransfers)
          .set({ status: 'CANCELLED' })
          .where(eq(p2pTransfers.id, transfer.id))

        // Update transaction status
        await dbClient
          .update(transactions)
          .set({ status: 'FAILED' })
          .where(eq(transactions.id, transaction.id))

        cancelledCount++
      }
    }

    return cancelledCount
  }

  // ==================== Payment History ====================

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
      id: string
      type: string
      amount: number
      status: string
      createdAt: Date
      merchant?: string
      recipient?: string
    }>
  > {
    const dbClient = initDB(db)

    const wallet = await dbClient.query.wallets.findFirst({
      where: eq(wallets.userId, userId),
    })

    if (!wallet) {
      throw new WalletNotFoundError(userId)
    }

    const walletTransactions = await dbClient.query.transactions.findMany({
      where: eq(transactions.walletId, wallet.id),
      limit,
      offset,
      orderBy: (transactions, { desc }) => [desc(transactions.createdAt)],
    })

    const result = []

    for (const tx of walletTransactions) {
      const item: any = {
        id: tx.id,
        type: tx.type.toLowerCase(),
        amount: tx.amount / 100,
        status: tx.status.toLowerCase(),
        createdAt: new Date((tx.createdAt as number) * 1000),
      }

      // Add merchant or recipient info based on type
      if (tx.type === 'PAYMENT') {
        const merchantPayment = await dbClient.query.merchantPayments.findFirst({
          where: eq(merchantPayments.transactionId, tx.id),
          with: { merchant: true },
        })
        if (merchantPayment?.merchant) {
          item.merchant = merchantPayment.merchant.businessName
        }
      } else if (tx.type === 'P2P') {
        const p2pTransfer = await dbClient.query.p2pTransfers.findFirst({
          where: eq(p2pTransfers.transactionId, tx.id),
        })
        // Parse metadata to get recipient info
        if (tx.metadata) {
          try {
            const metadata = JSON.parse(tx.metadata)
            if (metadata.recipientEmail) {
              item.recipient = metadata.recipientEmail
            } else if (metadata.senderEmail) {
              item.recipient = metadata.senderEmail
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      result.push(item)
    }

    return result
  }
}
