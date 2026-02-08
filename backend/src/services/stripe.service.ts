/**
 * Stripe Service Stub
 * Card processing integration for Tap2 Wallet
 *
 * This is a stub implementation for development.
 * In production, this would integrate with Stripe API for:
 * - Card tokenization
 * - Payment processing
 * - Customer management
 * - webhook handling
 */

export interface CardDetails {
  number: string
  expiryMonth: number
  expiryYear: number
  cvv: string
  cardholderName: string
  billingZip?: string
}

export interface StripeTokenResponse {
  tokenId: string
  lastFour: string
  brand: string
  funding: string
  expiryMonth: number
  expiryYear: number
}

export interface StripeChargeResponse {
  chargeId: string
  status: 'succeeded' | 'pending' | 'failed'
  amount: number // In cents
  currency: string
  createdAt: number
}

export interface StripeCustomerResponse {
  customerId: string
  email: string
  defaultSourceId?: string
  createdAt: number
}

export class StripeError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'StripeError'
  }
}

export class StripeService {
  private stripeSecretKey: string

  constructor() {
    // In production, this would come from environment variables
    this.stripeSecretKey = ''
  }

  /**
   * Create a payment method token from card details
   * This token can be safely stored and used for future charges
   *
   * Note: In production, card details should NEVER touch your server.
   * Use Stripe.js on the client to tokenize, then send only the token.
   */
  async createToken(cardDetails: CardDetails): Promise<StripeTokenResponse> {
    // Stub implementation - in production, call Stripe API
    // const stripe = require('stripe')(this.stripeSecretKey)
    // const token = await stripe.tokens.create({ card: cardDetails })

    // Simulate API delay
    await this.simulateNetworkDelay()

    // Validate card details
    this.validateCardDetails(cardDetails)

    // Generate a mock token
    const tokenId = `tok_${crypto.randomUUID().replace(/-/g, '')}`

    // Detect card brand from number
    const brand = this.detectCardBrand(cardDetails.number)

    return {
      tokenId,
      lastFour: cardDetails.number.slice(-4),
      brand,
      funding: 'debit', // Tap2 Wallet primarily uses debit
      expiryMonth: cardDetails.expiryMonth,
      expiryYear: cardDetails.expiryYear,
    }
  }

  /**
   * Create a customer in Stripe
   */
  async createCustomer(
    email: string,
    name: string,
    paymentMethodToken?: string
  ): Promise<StripeCustomerResponse> {
    await this.simulateNetworkDelay()

    const customerId = `cus_${crypto.randomUUID().replace(/-/g, '')}`

    return {
      customerId,
      email,
      defaultSourceId: paymentMethodToken,
      createdAt: Math.floor(Date.now() / 1000),
    }
  }

  /**
   * Attach a payment method to a customer
   */
  async attachPaymentMethod(
    customerId: string,
    paymentMethodToken: string
  ): Promise<{ paymentMethodId: string }> {
    await this.simulateNetworkDelay()

    return {
      paymentMethodId: `pm_${crypto.randomUUID().replace(/-/g, '')}`,
    }
  }

  /**
   * Charge a payment method
   * Used for funding wallet from card
   */
  async chargePaymentMethod(
    paymentMethodToken: string,
    amountInCents: number,
    currency: string = 'usd',
    description?: string
  ): Promise<StripeChargeResponse> {
    await this.simulateNetworkDelay()

    // Simulate occasional failure for testing (5% failure rate)
    if (Math.random() < 0.05) {
      throw new StripeError('Card declined', 'card_declined', 402)
    }

    return {
      chargeId: `ch_${crypto.randomUUID().replace(/-/g, '')}`,
      status: 'succeeded',
      amount: amountInCents,
      currency,
      createdAt: Math.floor(Date.now() / 1000),
    }
  }

  /**
   * Refund a charge
   */
  async refundCharge(
    chargeId: string,
    amountInCents?: number
  ): Promise<{ refundId: string; status: string }> {
    await this.simulateNetworkDelay()

    return {
      refundId: `re_${crypto.randomUUID().replace(/-/g, '')}`,
      status: 'succeeded',
    }
  }

  /**
   * Verify card ownership with a small authorization
   * This charges $0.50-$1.00 and immediately refunds it
   */
  async verifyCard(
    paymentMethodToken: string
  ): Promise<{ verified: boolean; authorizationId?: string }> {
    await this.simulateNetworkDelay()

    return {
      verified: true,
      authorizationId: `auth_${crypto.randomUUID().replace(/-/g, '')}`,
    }
  }

  /**
   * Retrieve payment method details from Stripe
   */
  async retrievePaymentMethod(
    paymentMethodId: string
  ): Promise<{
    id: string
    lastFour: string
    brand: string
    expiryMonth: number
    expiryYear: number
  }> {
    await this.simulateNetworkDelay()

    // Stub - return mock data
    return {
      id: paymentMethodId,
      lastFour: '4242',
      brand: 'visa',
      expiryMonth: 12,
      expiryYear: 2028,
    }
  }

  /**
   * Detach a payment method from a customer
   */
  async detachPaymentMethod(
    paymentMethodId: string
  ): Promise<{ deleted: boolean }> {
    await this.simulateNetworkDelay()

    return { deleted: true }
  }

  // ==================== Helper Methods ====================

  /**
   * Validate card details locally before sending to Stripe
   */
  private validateCardDetails(card: CardDetails): void {
    // Check Luhn algorithm for card number
    if (!this.isValidCardNumber(card.number)) {
      throw new StripeError('Invalid card number', 'invalid_number', 400)
    }

    // Check expiry
    const now = new Date()
    const expiryDate = new Date(card.expiryYear, card.expiryMonth - 1)
    if (expiryDate < now) {
      throw new StripeError('Card has expired', 'expired_card', 400)
    }

    // Check CVV length
    const cvvLength = card.cvv.length
    if (cvvLength < 3 || cvvLength > 4) {
      throw new StripeError('Invalid CVV', 'invalid_cvc', 400)
    }

    // Check cardholder name
    if (!card.cardholderName || card.cardholderName.trim().length < 2) {
      throw new StripeError('Cardholder name is required', 'invalid_name', 400)
    }
  }

  /**
   * Validate card number using Luhn algorithm
   */
  private isValidCardNumber(number: string): boolean {
    // Remove spaces and dashes
    const sanitized = number.replace(/[\s-]/g, '')

    // Check length (13-19 digits)
    if (sanitized.length < 13 || sanitized.length > 19) {
      return false
    }

    // Check if all digits
    if (!/^\d+$/.test(sanitized)) {
      return false
    }

    // Luhn algorithm
    let sum = 0
    let isEven = false

    for (let i = sanitized.length - 1; i >= 0; i--) {
      let digit = parseInt(sanitized[i], 10)

      if (isEven) {
        digit *= 2
        if (digit > 9) {
          digit -= 9
        }
      }

      sum += digit
      isEven = !isEven
    }

    return sum % 10 === 0
  }

  /**
   * Detect card brand from card number
   */
  private detectCardBrand(number: string): string {
    const sanitized = number.replace(/[\s-]/g, '')

    const patterns = {
      visa: /^4/,
      mastercard: /^5[1-5]|^2[2-7]/,
      amex: /^3[47]/,
      discover: /^6(?:011|5)/,
      diners: /^3(?:0[0-5]|[68])/,
      jcb: /^(?:2131|1800|35)/,
    }

    for (const [brand, pattern] of Object.entries(patterns)) {
      if (pattern.test(sanitized)) {
        return brand
      }
    }

    return 'unknown'
  }

  /**
   * Simulate network delay for realistic testing
   */
  private async simulateNetworkDelay(): Promise<void> {
    const delay = Math.random() * 200 + 100 // 100-300ms delay
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  /**
   * Handle Stripe webhook events
   * In production, this would verify webhook signatures
   */
  async handleWebhook(event: string, data: unknown): Promise<void> {
    // Stub implementation
    // In production, handle events like:
    // - payment_intent.succeeded
    // - payment_intent.failed
    // - charge.refunded
    // - customer.deleted

    console.log(`Stripe webhook: ${event}`, data)
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    webhookSecret: string
  ): boolean {
    // Stub implementation
    // In production, use Stripe's signature verification
    return true
  }
}

// Export singleton instance
export const stripeService = new StripeService()
