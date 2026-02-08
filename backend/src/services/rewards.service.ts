import { eq, desc, and, lt } from 'drizzle-orm'
import { initDB, rewards, transactions, merchants } from '../config/database.js'
import type { Reward } from '../config/database.js'

// Constants for points calculation
export const POINTS_PER_DOLLAR = 1 // 1 point per dollar spent
export const CENTS_PER_DOLLAR = 100 // 100 cents = 1 dollar
export const POINTS_TO_DOLLAR_RATE = 100 // 100 points = $1 discount
export const POINT_EXPIRY_YEARS = 1 // Points expire after 1 year

export interface RewardsBalanceResponse {
  totalPoints: number
  activePoints: number
  expiringPoints: number
  pointsValue: number // Dollar value of points (100 points = $1)
}

export interface RewardHistoryItem {
  id: string
  points: number
  type: 'earned' | 'redeemed' | 'expired'
  merchant?: string
  transactionId?: string
  createdAt: Date
  expiresAt?: Date
}

export interface RedemptionResult {
  redemptionId: string
  pointsRedeemed: number
  discountAmount: number // In cents
  remainingPoints: number
}

export interface RewardOffer {
  id: string
  title: string
  description: string
  pointsRequired: number
  discountAmount: number // In cents
  merchantId?: string
  merchantName?: string
  expiresAt?: Date
}

export class RewardsService {
  /**
   * Calculate points earned from a transaction amount
   * Rate: 1 point per dollar spent (100 cents = 1 point)
   */
  calculatePointsEarned(amountInCents: number): number {
    return Math.floor(amountInCents / CENTS_PER_DOLLAR) * POINTS_PER_DOLLAR
  }

  /**
   * Award points to a user after a completed payment
   * Points expire after 1 year from issuance
   */
  async awardPoints(
    db: D1Database,
    userId: string,
    amountInCents: number,
    transactionId: string,
    merchantId?: string
  ): Promise<Reward> {
    const dbClient = initDB(db)

    const pointsEarned = this.calculatePointsEarned(amountInCents)

    if (pointsEarned <= 0) {
      throw new Error('Transaction amount too small to earn points')
    }

    // Calculate expiration date (1 year from now)
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + POINT_EXPIRY_YEARS)

    const newReward: Reward = {
      id: crypto.randomUUID(),
      userId,
      points: pointsEarned,
      merchantId,
      transactionId,
      expiresAt: Math.floor(expiresAt.getTime() / 1000),
      createdAt: Math.floor(Date.now() / 1000),
    }

    const result = await dbClient.insert(rewards).values(newReward).returning()

    return result[0]!
  }

  /**
   * Get total rewards balance for a user
   * Includes active points and excludes expired points
   */
  async getRewardsBalance(db: D1Database, userId: string): Promise<RewardsBalanceResponse> {
    const dbClient = initDB(db)

    const now = Math.floor(Date.now() / 1000)

    // Get all active (non-expired) rewards
    const userRewards = await dbClient.query.rewards.findMany({
      where: and(eq(rewards.userId, userId)),
    })

    // Calculate totals
    let totalPoints = 0
    let activePoints = 0
    let expiringPoints = 0

    // 30 days from now in seconds
    const thirtyDaysFromNow = now + 30 * 24 * 60 * 60

    for (const reward of userRewards) {
      const isExpired = reward.expiresAt ? reward.expiresAt < now : false
      const isExpiringSoon = reward.expiresAt && reward.expiresAt < thirtyDaysFromNow && reward.expiresAt > now

      if (!isExpired) {
        totalPoints += reward.points
        activePoints += reward.points
      }

      if (isExpiringSoon) {
        expiringPoints += reward.points
      }
    }

    // Calculate dollar value (100 points = $1)
    const pointsValue = totalPoints / POINTS_TO_DOLLAR_RATE

    return {
      totalPoints,
      activePoints,
      expiringPoints,
      pointsValue,
    }
  }

  /**
   * Get rewards history for a user
   */
  async getRewardsHistory(
    db: D1Database,
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<RewardHistoryItem[]> {
    const dbClient = initDB(db)

    const userRewards = await dbClient.query.rewards.findMany({
      where: eq(rewards.userId, userId),
      orderBy: [desc(rewards.createdAt)],
      limit,
      offset,
      with: {
        merchant: true,
        transaction: true,
      },
    })

    const now = Math.floor(Date.now() / 1000)

    return userRewards.map((reward) => {
      const isExpired = reward.expiresAt ? reward.expiresAt < now : false
      const type: 'earned' | 'redeemed' | 'expired' = isExpired ? 'expired' : 'earned'

      return {
        id: reward.id,
        points: reward.points,
        type,
        merchant: reward.merchant?.businessName,
        transactionId: reward.transactionId ?? undefined,
        createdAt: new Date((reward.createdAt as number) * 1000),
        expiresAt: reward.expiresAt ? new Date((reward.expiresAt as number) * 1000) : undefined,
      }
    })
  }

  /**
   * Redeem points for a discount
   * Uses FIFO (First In, First Out) - oldest points are used first
   * Rate: 100 points = $1 (100 cents)
   */
  async redeemPoints(
    db: D1Database,
    userId: string,
    pointsToRedeem: number,
    transactionId?: string
  ): Promise<RedemptionResult> {
    const dbClient = initDB(db)

    if (pointsToRedeem <= 0) {
      throw new Error('Points to redeem must be greater than zero')
    }

    // Get current balance
    const balance = await this.getRewardsBalance(db, userId)

    if (balance.totalPoints < pointsToRedeem) {
      throw new Error(`Insufficient points. Available: ${balance.totalPoints}, Requested: ${pointsToRedeem}`)
    }

    // Get oldest active points (FIFO)
    const now = Math.floor(Date.now() / 1000)
    const oldestRewards = await dbClient.query.rewards.findMany({
      where: and(
        eq(rewards.userId, userId),
        // Only get non-expired rewards
        // Note: expiresAt can be null for non-expiring points (if we add them in future)
      ),
      orderBy: [rewards.createdAt], // Ascending order for FIFO
      with: {
        merchant: true,
      },
    })

    // Filter out expired rewards and collect active ones
    const activeRewards = oldestRewards.filter((r) => !r.expiresAt || r.expiresAt > now)

    // Calculate how many points to deduct from each reward (FIFO)
    let remainingToRedeem = pointsToRedeem
    const redemptionId = crypto.randomUUID()
    const updates: Array<{ id: string; newPoints: number }> = []

    for (const reward of activeRewards) {
      if (remainingToRedeem <= 0) break

      const pointsFromThis = Math.min(reward.points, remainingToRedeem)
      const newPoints = reward.points - pointsFromThis

      if (newPoints > 0) {
        updates.push({ id: reward.id, newPoints })
      } else {
        // If all points from this reward are used, we could either delete the record or set points to 0
        // For audit trail, we'll create a negative redemption record
      }

      remainingToRedeem -= pointsFromThis
    }

    // Update reward records in batch
    for (const update of updates) {
      await dbClient
        .update(rewards)
        .set({ points: update.newPoints })
        .where(eq(rewards.id, update.id))
    }

    // Create a redemption record (negative points)
    const discountAmount = Math.floor((pointsToRedeem / POINTS_TO_DOLLAR_RATE) * CENTS_PER_DOLLAR)

    await dbClient.insert(rewards).values({
      id: crypto.randomUUID(),
      userId,
      points: -pointsToRedeem, // Negative points indicate redemption
      transactionId: transactionId || null,
      expiresAt: null, // Redemptions don't expire
      createdAt: Math.floor(Date.now() / 1000),
    })

    // Get new balance
    const newBalance = await this.getRewardsBalance(db, userId)

    return {
      redemptionId,
      pointsRedeemed,
      discountAmount,
      remainingPoints: newBalance.totalPoints,
    }
  }

  /**
   * Get available reward offers
   * Returns mock offers for now - can be enhanced with dynamic offers from database
   */
  async getAvailableOffers(db: D1Database, userId?: string): Promise<RewardOffer[]> {
    // For now, return static offers
    // In production, these could be stored in the database and customized per user/merchant
    const offers: RewardOffer[] = [
      {
        id: 'offer-100-points',
        title: '$1 Off Your Next Purchase',
        description: 'Redeem 100 points for $1 discount at any Tap2 merchant',
        pointsRequired: 100,
        discountAmount: 100, // $1 in cents
      },
      {
        id: 'offer-500-points',
        title: '$5 Off',
        description: 'Redeem 500 points for $5 discount',
        pointsRequired: 500,
        discountAmount: 500, // $5 in cents
      },
      {
        id: 'offer-1000-points',
        title: '$10 Off',
        description: 'Redeem 1000 points for $10 discount',
        pointsRequired: 1000,
        discountAmount: 1000, // $10 in cents
      },
      {
        id: 'offer-2500-points',
        title: '$25 Off',
        description: 'Redeem 2500 points for $25 discount',
        pointsRequired: 2500,
        discountAmount: 2500, // $25 in cents
      },
      {
        id: 'offer-5000-points',
        title: '$50 Off',
        description: 'Redeem 5000 points for $50 discount',
        pointsRequired: 5000,
        discountAmount: 5000, // $50 in cents
      },
    ]

    return offers
  }

  /**
   * Mark old points as expired
   * This should be run periodically (e.g., daily cron job)
   * Points older than 1 year are marked as expired
   */
  async expireOldPoints(db: D1Database): Promise<number> {
    const dbClient = initDB(db)

    const now = Math.floor(Date.now() / 1000)

    // Find all expired rewards that still have points
    const expiredRewards = await dbClient.query.rewards.findMany({
      where: and(lt(rewards.expiresAt, now)),
    })

    let totalExpiredPoints = 0

    // Set points to 0 for expired rewards
    // We keep the record for audit trail but zero out the points
    for (const reward of expiredRewards) {
      if (reward.points > 0) {
        totalExpiredPoints += reward.points
        await dbClient
          .update(rewards)
          .set({ points: 0 })
          .where(eq(rewards.id, reward.id))
      }
    }

    return totalExpiredPoints
  }

  /**
   * Auto-award points from a completed transaction
   * This should be called after a payment is completed
   */
  async processTransactionRewards(
    db: D1Database,
    userId: string,
    transactionId: string,
    amountInCents: number,
    merchantId?: string
  ): Promise<Reward | null> {
    const pointsEarned = this.calculatePointsEarned(amountInCents)

    if (pointsEarned <= 0) {
      return null
    }

    return this.awardPoints(db, userId, amountInCents, transactionId, merchantId)
  }
}
