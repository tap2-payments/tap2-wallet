import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../index.js';
import { initDB } from '@/config/database';
import { rewards, merchants, merchantPayments } from '../../../drizzle/schema';
import { eq, and, desc, gte, lt, sql } from 'drizzle-orm';

export const rewardsRouter = new Hono<{ Bindings: Env }>();

// Validation schemas
const redeemPointsSchema = z.object({
  merchantId: z.string().optional(),
  amount: z.number().positive(),
  transactionId: z.string().optional(),
});

/**
 * GET /v1/rewards/balance
 * Get user's rewards balance
 */
rewardsRouter.get('/balance', async (c) => {
  try {
    const userId = c.req.header('x-user-id') || 'demo-user';
    const db = initDB(c.env.DB);

    // Calculate total points
    const result = await db
      .select({
        totalPoints: sql<number>`sum(${rewards.points})`.mapWith(Number),
      })
      .from(rewards)
      .where(eq(rewards.userId, userId));

    const totalPoints = result[0]?.totalPoints || 0;

    // Get expiring points
    const now = new Date();
    const expiringResult = await db
      .select({
        totalPoints: sql<number>`sum(${rewards.points})`.mapWith(Number),
      })
      .from(rewards)
      .where(
        and(
          eq(rewards.userId, userId),
          gte(rewards.expiresAt, now),
          lt(rewards.expiresAt, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) // Next 30 days
        )
      );

    const expiringPoints = expiringResult[0]?.totalPoints || 0;

    return c.json({
      totalPoints,
      expiringPoints,
      pointValue: 0.01, // 1 point = $0.01 (1 cent)
    });
  } catch (error) {
    console.error('Error fetching rewards balance:', error);
    return c.json({ error: 'Failed to fetch rewards balance' }, 500);
  }
});

/**
 * GET /v1/rewards/history
 * Get rewards transaction history
 */
rewardsRouter.get('/history', async (c) => {
  try {
    const userId = c.req.header('x-user-id') || 'demo-user';
    const limit = Math.min(Number(c.req.query('limit') || '50'), 100);
    const offset = Number(c.req.query('offset') || '0');
    const db = initDB(c.env.DB);

    const history = await db
      .select({
        id: rewards.id,
        points: rewards.points,
        merchantId: rewards.merchantId,
        transactionId: rewards.transactionId,
        expiresAt: rewards.expiresAt,
        createdAt: rewards.createdAt,
        merchantName: merchants.businessName,
      })
      .from(rewards)
      .leftJoin(merchants, eq(rewards.merchantId, merchants.id))
      .where(eq(rewards.userId, userId))
      .orderBy(desc(rewards.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({ history, total: history.length });
  } catch (error) {
    console.error('Error fetching rewards history:', error);
    return c.json({ error: 'Failed to fetch rewards history' }, 500);
  }
});

/**
 * POST /v1/rewards/redeem
 * Redeem points for discount
 */
rewardsRouter.post('/redeem', zValidator('json', redeemPointsSchema), async (c) => {
  try {
    const userId = c.req.header('x-user-id') || 'demo-user';
    const { merchantId, amount, transactionId } = c.req.valid('json');
    const db = initDB(c.env.DB);

    // Get user's point balance
    const balanceResult = await db
      .select({
        totalPoints: sql<number>`sum(${rewards.points})`.mapWith(Number),
      })
      .from(rewards)
      .where(eq(rewards.userId, userId));

    const totalPoints = balanceResult[0]?.totalPoints || 0;

    // Calculate points needed (1 point = 1 cent)
    const pointsNeeded = Math.ceil(amount * 100);

    if (totalPoints < pointsNeeded) {
      return c.json(
        { error: 'Insufficient points', needed: pointsNeeded, available: totalPoints },
        400
      );
    }

    // Find earliest expiring points to use first (FIFO)
    const userRewards = await db
      .select()
      .from(rewards)
      .where(and(eq(rewards.userId, userId), gte(rewards.expiresAt, new Date())))
      .orderBy(rewards.expiresAt);

    let pointsToRedeem = pointsNeeded;
    const redeemedRewardIds: string[] = [];

    for (const reward of userRewards) {
      if (pointsToRedeem <= 0) break;

      const pointsFromThis = Math.min(reward.points, pointsToRedeem);
      const remainingPoints = reward.points - pointsFromThis;

      if (remainingPoints > 0) {
        // Partial redemption
        await db.update(rewards).set({ points: remainingPoints }).where(eq(rewards.id, reward.id));
      } else {
        // Full redemption - mark as used
        await db.update(rewards).set({ points: 0 }).where(eq(rewards.id, reward.id));
        redeemedRewardIds.push(reward.id);
      }

      pointsToRedeem -= pointsFromThis;
    }

    // Record redemption
    const now = new Date();
    await db.insert(rewards).values({
      id: crypto.randomUUID(),
      userId,
      points: -pointsNeeded, // Negative for redemption
      transactionId: transactionId || null,
      merchantId,
      createdAt: now,
    });

    // Calculate discount amount
    const discountAmount = pointsNeeded * 0.01; // Points to dollars

    return c.json({
      success: true,
      pointsRedeemed: pointsNeeded,
      discountAmount,
      remainingPoints: totalPoints - pointsNeeded,
    });
  } catch (error) {
    console.error('Error redeeming points:', error);
    return c.json({ error: 'Failed to redeem points' }, 500);
  }
});

/**
 * POST /v1/rewards/calculate
 * Calculate points earned from a payment
 */
rewardsRouter.post('/calculate', async (c) => {
  try {
    const { amount, merchantId } = await c.req.json();
    const db = initDB(c.env.DB);

    // Get merchant to check point multiplier
    let pointMultiplier = 1; // Default 1x

    if (merchantId) {
      const [merchant] = await db
        .select()
        .from(merchants)
        .where(eq(merchants.id, merchantId))
        .limit(1);

      // TODO: Add point multiplier to merchant schema
      if (merchant) {
        pointMultiplier = 1; // Could be merchant-specific
      }
    }

    // Calculate points: 1 point per $1 spent (base rate)
    const pointsEarned = Math.floor(amount * 100 * pointMultiplier);

    return c.json({
      pointsEarned,
      pointMultiplier,
      dollarValue: pointsEarned * 0.01,
    });
  } catch (error) {
    console.error('Error calculating points:', error);
    return c.json({ error: 'Failed to calculate points' }, 500);
  }
});

/**
 * POST /v1/rewards/earn
 * Award points from a transaction (called by payment processing)
 */
rewardsRouter.post('/earn', async (c) => {
  try {
    const { transactionId, userId, amount } = await c.req.json();
    const db = initDB(c.env.DB);

    if (!transactionId || !userId || !amount) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Get transaction to find merchant
    const [payment] = await db
      .select({
        merchantId: merchantPayments.merchantId,
      })
      .from(merchantPayments)
      .where(eq(merchantPayments.transactionId, transactionId))
      .limit(1);

    const pointMultiplier = 1; // TODO: Get from merchant
    const pointsEarned = Math.floor(amount * 100 * pointMultiplier);

    // Calculate expiration (1 year from now)
    const now = new Date();
    const expiresAt = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    // Award points
    const [reward] = await db
      .insert(rewards)
      .values({
        id: crypto.randomUUID(),
        userId,
        points: pointsEarned,
        transactionId,
        merchantId: payment?.merchantId || null,
        expiresAt,
        createdAt: now,
      })
      .returning();

    return c.json({ reward, pointsEarned });
  } catch (error) {
    console.error('Error awarding points:', error);
    return c.json({ error: 'Failed to award points' }, 500);
  }
});

/**
 * GET /v1/rewards/merchants
 * Get merchants where points can be earned/redeemed
 */
rewardsRouter.get('/merchants', async (c) => {
  try {
    const db = initDB(c.env.DB);

    // Get active merchants
    const merchantList = await db
      .select({
        id: merchants.id,
        businessName: merchants.businessName,
        businessType: merchants.businessType,
      })
      .from(merchants)
      .where(sql`active = 1`)
      .orderBy(merchants.businessName);

    return c.json({ merchants: merchantList });
  } catch (error) {
    console.error('Error fetching merchants:', error);
    return c.json({ error: 'Failed to fetch merchants' }, 500);
  }
});
