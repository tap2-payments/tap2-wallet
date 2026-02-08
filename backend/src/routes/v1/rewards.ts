import { Hono } from 'hono'
import type { Env } from '../../index.js'
import { RewardsService } from '../../services/rewards.service.js'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

export const rewardsRouter = new Hono<{ Bindings: Env }>()

const rewardsService = new RewardsService()

// Validation schemas
const redeemPointsSchema = z.object({
  points: z.number().int().positive('Points must be a positive integer'),
  transactionId: z.string().optional(),
})

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
})

// GET /api/v1/rewards/balance
// Get user's current rewards balance
rewardsRouter.get('/balance', async (c) => {
  try {
    // TODO: Get userId from auth middleware
    const userId = c.req.header('x-user-id') || 'demo-user'

    const db = c.env.DB
    const balance = await rewardsService.getRewardsBalance(db, userId)

    return c.json({ balance })
  } catch (error) {
    console.error('Error getting rewards balance:', error)
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get rewards balance',
        status: 500,
      },
      500
    )
  }
})

// GET /api/v1/rewards/history
// Get user's rewards earning and redemption history
rewardsRouter.get(
  '/history',
  zValidator('query', historyQuerySchema),
  async (c) => {
    try {
      // TODO: Get userId from auth middleware
      const userId = c.req.header('x-user-id') || 'demo-user'
      const query = c.req.valid('query')

      const db = c.env.DB
      const history = await rewardsService.getRewardsHistory(db, userId, query.limit, query.offset)

      return c.json({ history })
    } catch (error) {
      console.error('Error getting rewards history:', error)
      return c.json(
        {
          error: error instanceof Error ? error.message : 'Failed to get rewards history',
          status: 500,
        },
        500
      )
    }
  }
)

// POST /api/v1/rewards/redeem
// Redeem points for a discount
rewardsRouter.post(
  '/redeem',
  zValidator('json', redeemPointsSchema),
  async (c) => {
    try {
      // TODO: Get userId from auth middleware
      const userId = c.req.header('x-user-id') || 'demo-user'
      const { points, transactionId } = c.req.valid('json')

      const db = c.env.DB
      const result = await rewardsService.redeemPoints(db, userId, points, transactionId)

      return c.json(result, 200)
    } catch (error) {
      console.error('Error redeeming points:', error)
      const statusCode =
        error instanceof Error && error.message.includes('Insufficient points') ? 400 : 500

      return c.json(
        {
          error: error instanceof Error ? error.message : 'Failed to redeem points',
          status: statusCode,
        },
        statusCode
      )
    }
  }
)

// GET /api/v1/rewards/offers
// Get available reward offers
rewardsRouter.get('/offers', async (c) => {
  try {
    // TODO: Get userId from auth middleware for personalized offers
    const userId = c.req.header('x-user-id') || 'demo-user'

    const db = c.env.DB
    const offers = await rewardsService.getAvailableOffers(db, userId)

    return c.json({ offers })
  } catch (error) {
    console.error('Error getting reward offers:', error)
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get reward offers',
        status: 500,
      },
      500
    )
  }
})
