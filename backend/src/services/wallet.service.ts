import { eq, desc, and, gte, lte, sql } from 'drizzle-orm'
import { initDB, wallets, transactions, paymentMethods, users } from '../config/database.js'
import type { Wallet, Transaction, PaymentMethod } from '../config/database.js'
import { stripeService } from './stripe.service.js'
import { plaidService } from './plaid.service.js'

export interface TransactionListOptions {
  limit?: number
  offset?: number
  startDate?: Date
  endDate?: Date
  type?: 'PAYMENT' | 'P2P' | 'FUND' | 'WITHDRAW'
}

export interface BalanceResponse {
  balance: number // In dollars (converted from cents)
  currency: string
}

export interface TransactionResponse {
  id: string
  type: string
  amount: number // In dollars (converted from cents)
  status: string
  createdAt: Date
  metadata: string | null
}

// ==================== Funding Source Types ====================

export interface CardDetails {
  number: string
  expiryMonth: number
  expiryYear: number
  cvv: string
  cardholderName: string
  billingZip?: string
}

export interface BankAccountDetails {
  plaidPublicToken: string
  accountId: string
  accountName: string
}

export interface AddPaymentMethodInput {
  type: 'card' | 'bank'
  cardDetails?: CardDetails
  bankDetails?: BankAccountDetails
  setAsDefault?: boolean
}

export interface PaymentMethodResponse {
  id: string
  type: string
  provider: string
  lastFour: string
  expiryMonth?: number
  expiryYear?: number
  isDefault: boolean
  isActive: boolean
  createdAt: Date
}

// ==================== Fund/Withdraw Types ====================

export interface FundWalletInput {
  paymentMethodId: string
  amount: number // In cents
  idempotencyKey?: string
}

export interface FundWalletResponse {
  transactionId: string
  amount: number // In dollars (converted from cents)
  newBalance: number // In dollars (converted from cents)
  status: string
  currency: string
}

export interface WithdrawFundsInput {
  paymentMethodId: string
  amount: number // In cents
  type: 'instant' | 'standard'
  idempotencyKey?: string
}

export interface WithdrawFundsResponse {
  transactionId: string
  amount: number // In dollars (converted from cents)
  fee: number // In dollars (converted from cents)
  netAmount: number // In dollars (converted from cents) - amount minus fee
  newBalance: number // In dollars (converted from cents)
  status: string
  estimatedArrival?: Date
  currency: string
}

// ==================== Custom Errors ====================

export class WalletError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'WalletError'
  }
}

export class InsufficientFundsError extends WalletError {
  constructor(currentBalance: number, requiredAmount: number) {
    super(
      `Insufficient funds. Current balance: $${(currentBalance / 100).toFixed(2)}, Required: $${(requiredAmount / 100).toFixed(2)}`,
      'INSUFFICIENT_FUNDS',
      400
    )
    this.name = 'InsufficientFundsError'
  }
}

export class PaymentMethodNotFoundError extends WalletError {
  constructor(methodId: string) {
    super(`Payment method not found: ${methodId}`, 'PAYMENT_METHOD_NOT_FOUND', 404)
    this.name = 'PaymentMethodNotFoundError'
  }
}

export class InvalidPaymentMethodError extends WalletError {
  constructor(message: string) {
    super(message, 'INVALID_PAYMENT_METHOD', 400)
    this.name = 'InvalidPaymentMethodError'
  }
}

export class CannotDeleteDefaultPaymentMethodError extends WalletError {
  constructor() {
    super('Cannot delete default payment method. Please set another payment method as default first.', 'CANNOT_DELETE_DEFAULT', 400)
    this.name = 'CannotDeleteDefaultPaymentMethodError'
  }
}

export class WalletService {
  /**
   * Get wallet balance for a user
   * Balance is stored in cents, returned in dollars
   */
  async getBalance(db: D1Database, userId: string): Promise<BalanceResponse> {
    const dbClient = initDB(db)

    const wallet = await dbClient.query.wallets.findFirst({
      where: eq(wallets.userId, userId),
    })

    if (!wallet) {
      throw new Error('Wallet not found')
    }

    // Convert cents to dollars
    return {
      balance: wallet.balance / 100,
      currency: wallet.currency,
    }
  }

  /**
   * Get transactions for a user's wallet
   * Amounts are stored in cents, returned in dollars
   */
  async getTransactions(
    db: D1Database,
    userId: string,
    options: TransactionListOptions = {}
  ): Promise<TransactionResponse[]> {
    const dbClient = initDB(db)

    // First get the wallet
    const wallet = await dbClient.query.wallets.findFirst({
      where: eq(wallets.userId, userId),
    })

    if (!wallet) {
      throw new Error('Wallet not found')
    }

    // Build where conditions
    const conditions: any[] = [eq(transactions.walletId, wallet.id)]

    if (options.type) {
      conditions.push(eq(transactions.type, options.type))
    }

    if (options.startDate || options.endDate) {
      const dateCondition: any = {}
      if (options.startDate) {
        dateCondition.gte = Math.floor(options.startDate.getTime() / 1000)
      }
      if (options.endDate) {
        dateCondition.lte = Math.floor(options.endDate.getTime() / 1000)
      }
      // Note: createdAt is stored as Unix timestamp in seconds
      // conditions.push(...) - need to handle timestamp comparison
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0]

    // Get transactions
    const walletTransactions = await dbClient.query.transactions.findMany({
      where: whereClause,
      orderBy: [desc(transactions.createdAt)],
      limit: options.limit ?? 20,
      offset: options.offset ?? 0,
    })

    return walletTransactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount / 100, // Convert cents to dollars
      status: tx.status,
      createdAt: new Date((tx.createdAt as number) * 1000), // Convert Unix timestamp to Date
      metadata: tx.metadata,
    }))
  }

  /**
   * Create a new wallet for a user
   */
  async createWallet(db: D1Database, userId: string): Promise<Wallet> {
    const dbClient = initDB(db)

    const newWallet: Wallet = {
      id: crypto.randomUUID(),
      userId,
      balance: 0, // Stored in cents
      currency: 'USD',
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    }

    const result = await dbClient.insert(wallets).values(newWallet).returning()

    return result[0]!
  }

  /**
   * Update wallet balance
   * @returns The new balance in cents
   */
  async updateBalance(
    db: D1Database,
    walletId: string,
    amountInCents: number,
    operation: 'increment' | 'decrement' = 'increment'
  ): Promise<number> {
    const dbClient = initDB(db)

    // Get current balance
    const wallet = await dbClient.query.wallets.findFirst({
      where: eq(wallets.id, walletId),
    })

    if (!wallet) {
      throw new Error('Wallet not found')
    }

    const newBalance =
      operation === 'increment'
        ? wallet.balance + amountInCents
        : wallet.balance - amountInCents

    if (newBalance < 0) {
      throw new Error('Insufficient funds')
    }

    // Update balance
    await dbClient
      .update(wallets)
      .set({
        balance: newBalance,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(wallets.id, walletId))

    return newBalance
  }

  // ==================== Funding Operations ====================

  /**
   * Fund wallet from a payment method (card or bank)
   * @returns The funding transaction details
   */
  async fundWallet(
    db: D1Database,
    userId: string,
    input: FundWalletInput
  ): Promise<FundWalletResponse> {
    const dbClient = initDB(db)

    // Check idempotency key if provided
    if (input.idempotencyKey) {
      const existingTransaction = await dbClient.query.transactions.findFirst({
        where: eq(transactions.referenceId, input.idempotencyKey),
      })
      if (existingTransaction) {
        const wallet = await dbClient.query.wallets.findFirst({
          where: eq(wallets.userId, userId),
        })
        return {
          transactionId: existingTransaction.id,
          amount: existingTransaction.amount / 100,
          newBalance: wallet ? wallet.balance / 100 : 0,
          status: existingTransaction.status.toLowerCase(),
          currency: 'USD',
        }
      }
    }

    // Validate amount
    if (input.amount < 100) {
      throw new WalletError('Minimum funding amount is $1.00', 'INVALID_AMOUNT', 400)
    }

    if (input.amount > 100000) {
      // $1,000 limit
      throw new WalletError('Maximum funding amount is $1,000.00', 'INVALID_AMOUNT', 400)
    }

    // Get payment method
    const paymentMethod = await dbClient.query.paymentMethods.findFirst({
      where: eq(paymentMethods.id, input.paymentMethodId),
    })

    if (!paymentMethod) {
      throw new PaymentMethodNotFoundError(input.paymentMethodId)
    }

    if (paymentMethod.userId !== userId) {
      throw new InvalidPaymentMethodError('Payment method does not belong to user')
    }

    if (!paymentMethod.isActive) {
      throw new InvalidPaymentMethodError('Payment method is inactive')
    }

    // Check card expiry if applicable
    if (paymentMethod.type === 'card' && paymentMethod.expiryMonth && paymentMethod.expiryYear) {
      const now = new Date()
      const expiryDate = new Date(paymentMethod.expiryYear, paymentMethod.expiryMonth - 1)
      if (expiryDate < now) {
        throw new InvalidPaymentMethodError('Card has expired')
      }
    }

    // Process payment based on type
    let chargeId: string
    if (paymentMethod.provider === 'stripe') {
      // Charge card via Stripe
      const chargeResult = await stripeService.chargePaymentMethod(
        paymentMethod.providerId!,
        input.amount,
        'usd',
        `Tap2 Wallet funding - ${userId}`
      )
      chargeId = chargeResult.chargeId
    } else if (paymentMethod.provider === 'plaid') {
      // Initiate ACH transfer via Plaid
      const transferResult = await plaidService.initiateTransfer(
        paymentMethod.providerId!,
        input.paymentMethodId, // Using the account ID stored in providerId or separate field
        input.amount,
        input.idempotencyKey || crypto.randomUUID()
      )
      chargeId = transferResult.transferId
    } else {
      throw new InvalidPaymentMethodError('Unsupported payment provider')
    }

    // Get or create user's wallet
    let wallet = await dbClient.query.wallets.findFirst({
      where: eq(wallets.userId, userId),
    })

    if (!wallet) {
      // Create wallet if it doesn't exist
      const newWalletId = crypto.randomUUID()
      const now = Math.floor(Date.now() / 1000)
      await dbClient.insert(wallets).values({
        id: newWalletId,
        userId,
        balance: input.amount,
        currency: 'USD',
        createdAt: now,
        updatedAt: now,
      })
      wallet = {
        id: newWalletId,
        userId,
        balance: input.amount,
        currency: 'USD',
        createdAt: now,
        updatedAt: now,
      }
    } else {
      // Update wallet balance
      const newBalance = wallet.balance + input.amount
      await dbClient
        .update(wallets)
        .set({
          balance: newBalance,
          updatedAt: Math.floor(Date.now() / 1000),
        })
        .where(eq(wallets.id, wallet.id))
      wallet.balance = newBalance
    }

    // Create transaction record
    const transactionId = crypto.randomUUID()
    await dbClient.insert(transactions).values({
      id: transactionId,
      walletId: wallet.id,
      type: 'FUND',
      amount: input.amount,
      status: 'COMPLETED',
      referenceId: input.idempotencyKey,
      metadata: JSON.stringify({
        paymentMethodId: input.paymentMethodId,
        provider: paymentMethod.provider,
        chargeId,
      }),
      createdAt: Math.floor(Date.now() / 1000),
    })

    return {
      transactionId,
      amount: input.amount / 100, // Convert cents to dollars
      newBalance: wallet.balance / 100,
      status: 'completed',
      currency: 'USD',
    }
  }

  /**
   * Withdraw funds to a bank account
   * Instant withdrawal: 1.5% fee, arrives in minutes
   * Standard withdrawal: Free, arrives in 1-2 business days
   */
  async withdrawFunds(
    db: D1Database,
    userId: string,
    input: WithdrawFundsInput
  ): Promise<WithdrawFundsResponse> {
    const dbClient = initDB(db)

    // Check idempotency key if provided
    if (input.idempotencyKey) {
      const existingTransaction = await dbClient.query.transactions.findFirst({
        where: eq(transactions.referenceId, input.idempotencyKey),
      })
      if (existingTransaction) {
        return {
          transactionId: existingTransaction.id,
          amount: existingTransaction.amount / 100,
          fee: 0,
          netAmount: existingTransaction.amount / 100,
          newBalance: 0,
          status: existingTransaction.status.toLowerCase(),
          currency: 'USD',
        }
      }
    }

    // Validate amount
    if (input.amount < 100) {
      throw new WalletError('Minimum withdrawal amount is $1.00', 'INVALID_AMOUNT', 400)
    }

    if (input.amount > 100000) {
      // $1,000 limit
      throw new WalletError('Maximum withdrawal amount is $1,000.00', 'INVALID_AMOUNT', 400)
    }

    // Get payment method (must be bank account)
    const paymentMethod = await dbClient.query.paymentMethods.findFirst({
      where: eq(paymentMethods.id, input.paymentMethodId),
    })

    if (!paymentMethod) {
      throw new PaymentMethodNotFoundError(input.paymentMethodId)
    }

    if (paymentMethod.userId !== userId) {
      throw new InvalidPaymentMethodError('Payment method does not belong to user')
    }

    if (paymentMethod.type !== 'bank') {
      throw new InvalidPaymentMethodError('Withdrawals are only supported to bank accounts')
    }

    if (!paymentMethod.isActive) {
      throw new InvalidPaymentMethodError('Payment method is inactive')
    }

    // Get user's wallet
    const wallet = await dbClient.query.wallets.findFirst({
      where: eq(wallets.userId, userId),
    })

    if (!wallet) {
      throw new WalletError('Wallet not found', 'WALLET_NOT_FOUND', 404)
    }

    // Calculate fee
    const fee = input.type === 'instant' ? Math.ceil(input.amount * 0.015) : 0
    const totalAmount = input.amount + fee

    // Check balance
    if (wallet.balance < totalAmount) {
      throw new InsufficientFundsError(wallet.balance, totalAmount)
    }

    // Process withdrawal via Plaid
    let transferId: string
    let estimatedArrival: Date | undefined

    if (input.type === 'instant') {
      const result = await plaidService.initiateInstantWithdrawal(
        paymentMethod.providerId!,
        paymentMethod.id,
        input.amount,
        input.idempotencyKey || crypto.randomUUID()
      )
      transferId = result.transferId
      estimatedArrival = new Date(result.expectedArrival * 1000)
    } else {
      const result = await plaidService.initiateTransfer(
        paymentMethod.providerId!,
        paymentMethod.id,
        input.amount,
        input.idempotencyKey || crypto.randomUUID(),
        'credit'
      )
      transferId = result.transferId
      estimatedArrival = new Date(plaidService.calculateStandardArrival() * 1000)
    }

    // Deduct from wallet balance
    const newBalance = wallet.balance - totalAmount
    await dbClient
      .update(wallets)
      .set({
        balance: newBalance,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(wallets.id, wallet.id))

    // Create transaction record
    const transactionId = crypto.randomUUID()
    await dbClient.insert(transactions).values({
      id: transactionId,
      walletId: wallet.id,
      type: 'WITHDRAW',
      amount: input.amount,
      status: 'COMPLETED',
      referenceId: input.idempotencyKey,
      metadata: JSON.stringify({
        paymentMethodId: input.paymentMethodId,
        provider: paymentMethod.provider,
        transferId,
        withdrawalType: input.type,
        fee,
        estimatedArrival: estimatedArrival?.toISOString(),
      }),
      createdAt: Math.floor(Date.now() / 1000),
    })

    return {
      transactionId,
      amount: input.amount / 100,
      fee: fee / 100,
      netAmount: input.amount / 100,
      newBalance: newBalance / 100,
      status: 'completed',
      estimatedArrival,
      currency: 'USD',
    }
  }

  // ==================== Payment Method Management ====================

  /**
   * Add a payment method (card or bank account) for a user
   */
  async addPaymentMethod(
    db: D1Database,
    userId: string,
    input: AddPaymentMethodInput
  ): Promise<PaymentMethodResponse> {
    const dbClient = initDB(db)

    // Verify user exists
    const user = await dbClient.query.users.findFirst({
      where: eq(users.id, userId),
    })

    if (!user) {
      throw new WalletError('User not found', 'USER_NOT_FOUND', 404)
    }

    let providerId: string
    let lastFour: string
    let expiryMonth: number | undefined
    let expiryYear: number | undefined
    let provider: string

    if (input.type === 'card') {
      if (!input.cardDetails) {
        throw new WalletError('Card details required for card payment method', 'INVALID_INPUT', 400)
      }

      // Create Stripe token
      const tokenResult = await stripeService.createToken(input.cardDetails)
      providerId = tokenResult.tokenId
      lastFour = tokenResult.lastFour
      expiryMonth = tokenResult.expiryMonth
      expiryYear = tokenResult.expiryYear
      provider = 'stripe'

      // Verify card ownership with small authorization
      const verification = await stripeService.verifyCard(providerId)
      if (!verification.verified) {
        throw new InvalidPaymentMethodError('Card verification failed')
      }
    } else if (input.type === 'bank') {
      if (!input.bankDetails) {
        throw new WalletError('Bank details required for bank payment method', 'INVALID_INPUT', 400)
      }

      // Exchange public token for access token
      const exchangeResult = await plaidService.exchangePublicToken(input.bankDetails.plaidPublicToken)
      providerId = exchangeResult.accessToken

      // Get bank account details
      const accounts = await plaidService.getBankAccounts(providerId)
      const account = accounts.find((a) => a.accountId === input.bankDetails!.accountId)

      if (!account) {
        throw new InvalidPaymentMethodError('Bank account not found')
      }

      lastFour = account.lastFour
      provider = 'plaid'
    } else {
      throw new WalletError('Invalid payment method type', 'INVALID_TYPE', 400)
    }

    // If setting as default, unset other defaults
    if (input.setAsDefault) {
      await dbClient
        .update(paymentMethods)
        .set({ isDefault: false })
        .where(eq(paymentMethods.userId, userId))
    }

    // Create payment method record
    const paymentMethodId = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    await dbClient.insert(paymentMethods).values({
      id: paymentMethodId,
      userId,
      type: input.type,
      provider,
      providerId,
      isDefault: input.setAsDefault ?? false,
      lastFour,
      expiryMonth,
      expiryYear,
      isActive: true,
      createdAt: now,
    })

    return {
      id: paymentMethodId,
      type: input.type,
      provider,
      lastFour,
      expiryMonth,
      expiryYear,
      isDefault: input.setAsDefault ?? false,
      isActive: true,
      createdAt: new Date(now * 1000),
    }
  }

  /**
   * Get all payment methods for a user
   */
  async getPaymentMethods(
    db: D1Database,
    userId: string
  ): Promise<PaymentMethodResponse[]> {
    const dbClient = initDB(db)

    const methods = await dbClient.query.paymentMethods.findMany({
      where: eq(paymentMethods.userId, userId),
      orderBy: [desc(paymentMethods.isDefault), desc(paymentMethods.createdAt)],
    })

    return methods.map((method) => ({
      id: method.id,
      type: method.type,
      provider: method.provider || 'unknown',
      lastFour: method.lastFour || '',
      expiryMonth: method.expiryMonth ?? undefined,
      expiryYear: method.expiryYear ?? undefined,
      isDefault: method.isDefault,
      isActive: method.isActive,
      createdAt: new Date((method.createdAt as number) * 1000),
    }))
  }

  /**
   * Remove a payment method
   * Cannot remove the default payment method if other methods exist
   */
  async removePaymentMethod(
    db: D1Database,
    userId: string,
    paymentMethodId: string
  ): Promise<{ removed: boolean }> {
    const dbClient = initDB(db)

    // Get the payment method
    const paymentMethod = await dbClient.query.paymentMethods.findFirst({
      where: eq(paymentMethods.id, paymentMethodId),
    })

    if (!paymentMethod) {
      throw new PaymentMethodNotFoundError(paymentMethodId)
    }

    if (paymentMethod.userId !== userId) {
      throw new InvalidPaymentMethodError('Payment method does not belong to user')
    }

    // Check if it's the default payment method
    if (paymentMethod.isDefault) {
      // Check if there are other payment methods
      const otherMethods = await dbClient.query.paymentMethods.findMany({
        where: and(
          eq(paymentMethods.userId, userId),
          sql`${paymentMethods.id} != ${paymentMethodId}`
        ),
      })

      if (otherMethods.length > 0) {
        throw new CannotDeleteDefaultPaymentMethodError()
      }
    }

    // Soft delete by setting isActive to false
    await dbClient
      .update(paymentMethods)
      .set({ isActive: false })
      .where(eq(paymentMethods.id, paymentMethodId))

    return { removed: true }
  }

  /**
   * Set a payment method as the default
   */
  async setDefaultPaymentMethod(
    db: D1Database,
    userId: string,
    paymentMethodId: string
  ): Promise<{ updated: boolean }> {
    const dbClient = initDB(db)

    // Verify the payment method exists and belongs to user
    const paymentMethod = await dbClient.query.paymentMethods.findFirst({
      where: eq(paymentMethods.id, paymentMethodId),
    })

    if (!paymentMethod) {
      throw new PaymentMethodNotFoundError(paymentMethodId)
    }

    if (paymentMethod.userId !== userId) {
      throw new InvalidPaymentMethodError('Payment method does not belong to user')
    }

    if (!paymentMethod.isActive) {
      throw new InvalidPaymentMethodError('Cannot set inactive payment method as default')
    }

    // Unset all other defaults for this user
    await dbClient
      .update(paymentMethods)
      .set({ isDefault: false })
      .where(eq(paymentMethods.userId, userId))

    // Set this one as default
    await dbClient
      .update(paymentMethods)
      .set({ isDefault: true })
      .where(eq(paymentMethods.id, paymentMethodId))

    return { updated: true }
  }

  /**
   * Get the default payment method for a user
   */
  async getDefaultPaymentMethod(
    db: D1Database,
    userId: string
  ): Promise<PaymentMethodResponse | null> {
    const dbClient = initDB(db)

    const paymentMethod = await dbClient.query.paymentMethods.findFirst({
      where: and(
        eq(paymentMethods.userId, userId),
        eq(paymentMethods.isDefault, true),
        eq(paymentMethods.isActive, true)
      ),
    })

    if (!paymentMethod) {
      return null
    }

    return {
      id: paymentMethod.id,
      type: paymentMethod.type,
      provider: paymentMethod.provider || 'unknown',
      lastFour: paymentMethod.lastFour || '',
      expiryMonth: paymentMethod.expiryMonth ?? undefined,
      expiryYear: paymentMethod.expiryYear ?? undefined,
      isDefault: paymentMethod.isDefault,
      isActive: paymentMethod.isActive,
      createdAt: new Date((paymentMethod.createdAt as number) * 1000),
    }
  }
}
