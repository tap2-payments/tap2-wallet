import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../index.js';
import { initDB } from '@/config/database';
import { virtualCards, wallets, transactions } from '../../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';

export const virtualCardRouter = new Hono<{ Bindings: Env }>();

// Validation schemas
const freezeCardSchema = z.object({
  reason: z.string().optional(),
});

const updateLimitSchema = z.object({
  spendingLimit: z.number().positive().max(1000000), // Max $10,000
});

/**
 * GET /v1/virtual-card
 * Get user's virtual card
 */
virtualCardRouter.get('/', async (c) => {
  try {
    const userId = c.req.header('x-user-id') || 'demo-user';
    const db = initDB(c.env.DB);

    const [card] = await db
      .select()
      .from(virtualCards)
      .where(eq(virtualCards.userId, userId))
      .orderBy(desc(virtualCards.createdAt))
      .limit(1);

    if (!card) {
      return c.json({ found: false, message: 'No virtual card found' }, 404);
    }

    // Mask sensitive details
    const maskedCard = {
      id: card.id,
      cardLastFour: card.cardLastFour,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      status: card.status,
      spendingLimit: card.spendingLimit,
      isActive: card.isActive,
      frozenAt: card.frozenAt,
      createdAt: card.createdAt,
    };

    return c.json({ virtualCard: maskedCard });
  } catch (error) {
    console.error('Error fetching virtual card:', error);
    return c.json({ error: 'Failed to fetch virtual card' }, 500);
  }
});

/**
 * POST /v1/virtual-card
 * Create a new virtual card
 */
virtualCardRouter.post('/', async (c) => {
  try {
    const userId = c.req.header('x-user-id') || 'demo-user';
    const db = initDB(c.env.DB);

    // Check if user already has a card
    const [existing] = await db
      .select()
      .from(virtualCards)
      .where(eq(virtualCards.userId, userId))
      .limit(1);

    if (existing) {
      return c.json({ error: 'Virtual card already exists' }, 400);
    }

    // TODO: Integrate with card provider (Stripe, Marqeta)
    // For now, generate a mock card
    const now = new Date();
    const expiryMonth = now.getMonth() + 1;
    const expiryYear = now.getFullYear() + 3; // 3 years from now
    const cardLastFour = Math.floor(1000 + Math.random() * 9000).toString();
    const cardToken = `tok_${crypto.randomUUID().replace(/-/g, '')}`;

    const [virtualCard] = await db
      .insert(virtualCards)
      .values({
        id: crypto.randomUUID(),
        userId,
        cardLastFour,
        cardToken,
        expiryMonth,
        expiryYear,
        status: 'ACTIVE',
        provider: 'stripe', // TODO: Make configurable
        providerCardId: crypto.randomUUID(),
        spendingLimit: 500000, // $5000 default daily limit
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json({ virtualCard }, 201);
  } catch (error) {
    console.error('Error creating virtual card:', error);
    return c.json({ error: 'Failed to create virtual card' }, 500);
  }
});

/**
 * POST /v1/virtual-card/freeze
 * Freeze the virtual card
 */
virtualCardRouter.post(
  '/freeze',
  zValidator('json', freezeCardSchema),
  async (c) => {
    try {
      const userId = c.req.header('x-user-id') || 'demo-user';
      const { reason } = c.req.valid('json');
      const db = initDB(c.env.DB);

      const now = new Date();

      const [card] = await db
        .update(virtualCards)
        .set({
          isActive: false,
          frozenAt: now,
          frozenReason: reason || 'User requested',
          updatedAt: now,
        })
        .where(and(eq(virtualCards.userId, userId), eq(virtualCards.isActive, true)))
        .returning();

    if (!card) {
      return c.json({ error: 'No active virtual card found' }, 404);
    }

    return c.json({ virtualCard: card[0], message: 'Card frozen successfully' });
  } catch (error) {
    console.error('Error freezing card:', error);
    return c.json({ error: 'Failed to freeze card' }, 500);
  }
);

/**
 * POST /v1/virtual-card/unfreeze
 * Unfreeze the virtual card
 */
virtualCardRouter.post('/unfreeze', async (c) => {
  try {
    const userId = c.req.header('x-user-id') || 'demo-user';
    const db = initDB(c.env.DB);

    const now = new Date();

    const [card] = await db
      .update(virtualCards)
      .set({
        isActive: true,
        frozenAt: null,
        frozenReason: null,
        updatedAt: now,
      })
      .where(and(eq(virtualCards.userId, userId), eq(virtualCards.isActive, false)))
      .returning();

    if (!card) {
      return c.json({ error: 'No frozen virtual card found' }, 404);
    }

    return c.json({ virtualCard: card[0], message: 'Card unfrozen successfully' });
  } catch (error) {
    console.error('Error unfreezing card:', error);
    return c.json({ error: 'Failed to unfreeze card' }, 500);
  }
});

/**
 * PATCH /v1/virtual-card/limit
 * Update spending limit
 */
virtualCardRouter.patch(
  '/limit',
  zValidator('json', updateLimitSchema),
  async (c) => {
    try {
      const userId = c.req.header('x-user-id') || 'demo-user';
      const { spendingLimit } = c.req.valid('json');
      const db = initDB(c.env.DB);

      const now = new Date();

      const [card] = await db
        .update(virtualCards)
        .set({
          spendingLimit,
          spendingLimitResetAt: now, // Reset the counter
          updatedAt: now,
        })
        .where(eq(virtualCards.userId, userId))
        .returning();

    if (!card) {
      return c.json({ error: 'Virtual card not found' }, 404);
    }

    return c.json({ virtualCard: card[0] });
  } catch (error) {
    console.error('Error updating limit:', error);
    return c.json({ error: 'Failed to update spending limit' }, 500);
  }
});

/**
 * GET /v1/virtual-card/transactions
 * Get transaction history for the virtual card
 */
virtualCardRouter.get('/transactions', async (c) => {
  try {
    const userId = c.req.header('x-user-id') || 'demo-user';
    const limit = Math.min(Number(c.req.query('limit') || '50'), 100);
    const offset = Number(c.req.query('offset') || '0');
    const db = initDB(c.env.DB);

    // Get user's virtual card
    const [card] = await db
      .select()
      .from(virtualCards)
      .where(eq(virtualCards.userId, userId))
      .limit(1);

    if (!card) {
      return c.json({ error: 'Virtual card not found' }, 404);
    }

    // Get user's wallet
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!wallet) {
      return c.json({ transactions: [], total: 0 });
    }

    // Get transactions
    const cardTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.walletId, wallet.id))
      .orderBy(desc(transactions.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({ transactions: cardTransactions, total: cardTransactions.length });
  } catch (error) {
    console.error('Error fetching card transactions:', error);
    return c.json({ error: 'Failed to fetch transactions' }, 500);
  }
});

/**
 * POST /v1/virtual-card/close
 * Close (permanently deactivate) the virtual card
 */
virtualCardRouter.post('/close', async (c) => {
  try {
    const userId = c.req.header('x-user-id') || 'demo-user';
    const db = initDB(c.env.DB);

    const now = new Date();

    const [card] = await db
      .update(virtualCards)
      .set({
        status: 'CLOSED',
        isActive: false,
        closedAt: now,
        updatedAt: now,
      })
      .where(and(eq(virtualCards.userId, userId), eq(virtualCards.status, 'ACTIVE')))
      .returning();

    if (!card) {
      return c.json({ error: 'No active virtual card found' }, 404);
    }

    // TODO: Notify card provider to close the card

    return c.json({ message: 'Card closed successfully' });
  } catch (error) {
    console.error('Error closing card:', error);
    return c.json({ error: 'Failed to close card' }, 500);
  }
});
