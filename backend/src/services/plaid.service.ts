/**
 * Plaid Service Stub
 * Bank account linking integration for Tap2 Wallet
 *
 * This is a stub implementation for development.
 * In production, this would integrate with Plaid API for:
 * - Bank account linking via Link
 * - Account verification
 * - ACH transfers
 * - Balance checking
 * - Webhook handling
 */

export interface PlaidLinkTokenResponse {
  linkToken: string
  expiresAt: number
}

export interface PlaidPublicTokenExchangeResponse {
  accessToken: string
  itemId: string
}

export interface PlaidBankAccount {
  accountId: string
  bankName: string
  accountName: string
  accountType: 'checking' | 'savings'
  accountSubtype?: string
  lastFour: string
  routingNumber?: string
  mask: string
}

export interface PlaidBalance {
  available: number
  current: number
  limit: number | null
  currency: string
}

export interface PlaidTransferResponse {
  transferId: string
  status: 'pending' | 'posted' | 'failed' | 'cancelled'
  amount: number
  currency: string
  createdAt: number
  expectedArrival?: number
}

export class PlaidError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'PlaidError'
  }
}

export class PlaidService {
  private plaidClientId: string
  private plaidSecret: string
  private plaidEnvironment: 'sandbox' | 'development' | 'production'

  constructor() {
    // In production, these would come from environment variables
    this.plaidClientId = ''
    this.plaidSecret = ''
    this.plaidEnvironment = 'sandbox'
  }

  /**
   * Create a Link token for the frontend Plaid Link flow
   * The frontend uses this token to initialize Plaid Link
   */
  async createLinkToken(
    userId: string,
    language: string = 'en',
    countryCodes: string[] = ['US']
  ): Promise<PlaidLinkTokenResponse> {
    // Stub implementation - in production, call Plaid API
    // const plaid = require('plaid')
    // const client = new plaid.PlaidApi(...)
    // const response = await client.linkTokenCreate({ ... })

    await this.simulateNetworkDelay()

    return {
      linkToken: `link-sandbox-${crypto.randomUUID()}`,
      expiresAt: Math.floor(Date.now() / 1000) + 4 * 60 * 60, // 4 hours
    }
  }

  /**
   * Exchange a public token for an access token
   * Called after user successfully links their bank via Plaid Link
   */
  async exchangePublicToken(
    publicToken: string
  ): Promise<PlaidPublicTokenExchangeResponse> {
    await this.simulateNetworkDelay()

    // Validate public token format
    if (!publicToken.startsWith('public-')) {
      throw new PlaidError('Invalid public token', 'INVALID_PUBLIC_TOKEN', 400)
    }

    return {
      accessToken: `access-sandbox-${crypto.randomUUID()}`,
      itemId: `item-sandbox-${crypto.randomUUID()}`,
    }
  }

  /**
   * Get bank accounts associated with an access token
   */
  async getBankAccounts(accessToken: string): Promise<PlaidBankAccount[]> {
    await this.simulateNetworkDelay()

    // Stub implementation - return mock accounts
    return [
      {
        accountId: 'acc-checking-123',
        bankName: 'Chase',
        accountName: 'Plaid Checking',
        accountType: 'checking',
        accountSubtype: 'checking',
        lastFour: '1234',
        routingNumber: '021000021',
        mask: '0000',
      },
      {
        accountId: 'acc-savings-456',
        bankName: 'Chase',
        accountName: 'Plaid Savings',
        accountType: 'savings',
        accountSubtype: 'savings',
        lastFour: '5678',
        routingNumber: '021000021',
        mask: '0000',
      },
    ]
  }

  /**
   * Get balance for a specific bank account
   */
  async getAccountBalance(
    accessToken: string,
    accountId: string
  ): Promise<PlaidBalance> {
    await this.simulateNetworkDelay()

    // Stub - return mock balance
    return {
      available: 500000, // $5,000.00 in cents
      current: 525000, // $5,250.00 in cents
      limit: null,
      currency: 'USD',
    }
  }

  /**
   * Get balances for all accounts
   */
  async getAllAccountBalances(accessToken: string): Promise<
    Array<{
      accountId: string
      balance: PlaidBalance
    }>
  > {
    await this.simulateNetworkDelay()

    const accounts = await this.getBankAccounts(accessToken)
    return accounts.map((account) => ({
      accountId: account.accountId,
      balance: {
        available: 500000,
        current: 525000,
        limit: null,
        currency: 'USD',
      },
    }))
  }

  /**
   * Initiate an ACH transfer from bank account to Tap2 Wallet
   * Used for funding wallet from bank
   */
  async initiateTransfer(
    accessToken: string,
    accountId: string,
    amountInCents: number,
    idempotencyKey: string,
    type: 'debit' | 'credit' = 'debit'
  ): Promise<PlaidTransferResponse> {
    await this.simulateNetworkDelay()

    // Validate amount
    if (amountInCents < 100) {
      throw new PlaidError('Transfer amount must be at least $1.00', 'INVALID_AMOUNT', 400)
    }

    if (amountInCents > 1000000) {
      // $10,000 limit
      throw new PlaidError('Transfer amount exceeds limit', 'AMOUNT_EXCEEDS_LIMIT', 400)
    }

    return {
      transferId: `tr_${crypto.randomUUID().replace(/-/g, '')}`,
      status: 'pending',
      amount: amountInCents,
      currency: 'USD',
      createdAt: Math.floor(Date.now() / 1000),
      expectedArrival: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 1 day
    }
  }

  /**
   * Get transfer status
   */
  async getTransferStatus(
    transferId: string
  ): Promise<PlaidTransferResponse> {
    await this.simulateNetworkDelay()

    // Stub - return pending status
    return {
      transferId,
      status: 'pending',
      amount: 50000,
      currency: 'USD',
      createdAt: Math.floor(Date.now() / 1000) - 3600,
      expectedArrival: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    }
  }

  /**
   * Cancel a pending transfer
   */
  async cancelTransfer(transferId: string): Promise<{ cancelled: boolean }> {
    await this.simulateNetworkDelay()

    return { cancelled: true }
  }

  /**
   * Initiate an instant withdrawal (instant ACH / real-time payments)
   * This has a fee and processes in minutes
   */
  async initiateInstantWithdrawal(
    accessToken: string,
    accountId: string,
    amountInCents: number,
    idempotencyKey: string
  ): Promise<PlaidTransferResponse> {
    await this.simulateNetworkDelay()

    return {
      transferId: `tr_instant_${crypto.randomUUID().replace(/-/g, '')}`,
      status: 'pending',
      amount: amountInCents,
      currency: 'USD',
      createdAt: Math.floor(Date.now() / 1000),
      expectedArrival: Math.floor(Date.now() / 1000) + 300, // 5 minutes
    }
  }

  /**
   * Verify bank account ownership with micro-deposits
   * This is an alternative to instant verification
   */
  async initiateMicroDeposits(
    accessToken: string,
    accountId: string
  ): Promise<{ verificationId: string; status: string }> {
    await this.simulateNetworkDelay()

    return {
      verificationId: `ver_${crypto.randomUUID().replace(/-/g, '')}`,
      status: 'pending',
    }
  }

  /**
   * Verify micro-deposit amounts
   */
  async verifyMicroDeposits(
    verificationId: string,
    amount1: number,
    amount2: number
  ): Promise<{ verified: boolean }> {
    await this.simulateNetworkDelay()

    // Stub - always succeed for amounts between 1-99 cents
    if (amount1 < 1 || amount1 > 99 || amount2 < 1 || amount2 > 99) {
      throw new PlaidError('Invalid micro-deposit amounts', 'INVALID_AMOUNTS', 400)
    }

    return { verified: true }
  }

  /**
   * Get institution details
   */
  async getInstitution(institutionId: string): Promise<{
    institutionId: string
    name: string
    logo?: string
    countryCodes: string[]
  }> {
    await this.simulateNetworkDelay()

    // Stub - return mock institution
    return {
      institutionId,
      name: 'Chase',
      logo: 'https://logo.clearbit.com/chase.com',
      countryCodes: ['US'],
    }
  }

  /**
   * Remove an item (unlink bank account)
   */
  async removeItem(accessToken: string): Promise<{ removed: boolean }> {
    await this.simulateNetworkDelay()

    return { removed: true }
  }

  /**
   * Refresh login for an item (when credentials expired)
   */
  async refreshLogin(accessToken: string): Promise<{ success: boolean }> {
    await this.simulateNetworkDelay()

    return { success: true }
  }

  // ==================== Helper Methods ====================

  /**
   * Simulate network delay for realistic testing
   */
  private async simulateNetworkDelay(): Promise<void> {
    const delay = Math.random() * 200 + 100 // 100-300ms delay
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  /**
   * Handle Plaid webhook events
   * In production, this would verify webhook signatures
   */
  async handleWebhook(event: string, data: unknown): Promise<void> {
    // Stub implementation
    // In production, handle events like:
    // - TRANSFER_UPDATE
    // - BANK_TRANSFER_TRANSFER_UPDATES
    // - ITEM_LOGIN_REQUIRED
    // - ITEM_WEBHOOK_UPDATE_ENABLED

    console.log(`Plaid webhook: ${event}`, data)

    // Specific event handling
    switch (event) {
      case 'TRANSFER_UPDATE':
        // Update transfer status in database
        break
      case 'ITEM_LOGIN_REQUIRED':
        // Notify user to re-authenticate
        break
      case 'BANK_TRANSFER_TRANSFER_UPDATES':
        // Process bank transfer updates
        break
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    webhookKey: string
  ): boolean {
    // Stub implementation
    // In production, use Plaid's signature verification
    return true
  }

  /**
   * Calculate estimated arrival for standard ACH
   * Standard ACH: 1-2 business days
   */
  calculateStandardArrival(): number {
    const now = new Date()
    const businessDaysToAdd = 2

    // Add business days (skip weekends)
    let daysAdded = 0
    let currentDate = new Date(now)

    while (daysAdded < businessDaysToAdd) {
      currentDate.setDate(currentDate.getDate() + 1)
      const dayOfWeek = currentDate.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Not Saturday or Sunday
        daysAdded++
      }
    }

    return Math.floor(currentDate.getTime() / 1000)
  }

  /**
   * Calculate fee for instant withdrawal
   */
  calculateInstantWithdrawalFee(amountInCents: number): number {
    // 1.5% fee for instant withdrawal
    return Math.ceil(amountInCents * 0.015)
  }
}

// Export singleton instance
export const plaidService = new PlaidService()
