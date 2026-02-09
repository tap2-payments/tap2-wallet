import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../index.js';
import { initDB } from '@/config/database';
import { fundingSources } from '@/drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';

export const fundingRouter = new Hono<{ Bindings: Env }>();

// Validation schemas
const createFundingSourceSchema = z.object({
  type: z.enum(['bank_account', 'debit_card', 'credit_card']),
  provider: z.enum(['plaid', 'stripe']),
  providerAccountId: z.string().optional(),
  institutionName: z.string().optional(),
  accountLastFour: z.string().length(4).optional(),
  accountType: z.string().optional(),
  plaidAccessToken: z.string().optional(),
  plaidItemId: z.string().optional(),
  stripePaymentMethodId: z.string().optional(),
  isDefault: z.boolean().optional(),
});

/**
 * GET /v1/funding-sources
 * Get all funding sources for the authenticated user
 */
fundingRouter.get('/', async (c) => {
  try {
    const userId = c.req.header('x-user-id') || 'demo-user';
    const db = initDB(c.env.DB);

    const sources = await db
      .select()
      .from(fundingSources)
      .where(eq(fundingSources.userId, userId))
      .orderBy(desc(fundingSources.isDefault), desc(fundingSources.createdAt));

    return c.json({
      fundingSources: sources,
      total: sources.length,
    });
  } catch (error) {
    console.error('Error fetching funding sources:', error);
    return c.json({ error: 'Failed to fetch funding sources' }, 500);
  }
});

/**
 * GET /v1/funding-sources/:id
 * Get a specific funding source
 */
fundingRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.req.header('x-user-id') || 'demo-user';

    const source = await initDB(c.env.DB)
      .select()
      .from(fundingSources)
      .where(and(eq(fundingSources.id, id), eq(fundingSources.userId, userId)))
      .limit(1);

    if (!source.length) {
      return c.json({ error: 'Funding source not found' }, 404);
    }

    return c.json({ fundingSource: source[0] });
  } catch (error) {
    console.error('Error fetching funding source:', error);
    return c.json({ error: 'Failed to fetch funding source' }, 500);
  }
});

/**
 * POST /v1/funding-sources
 * Create a new funding source
 */
fundingRouter.post('/', zValidator('json', createFundingSourceSchema), async (c) => {
  try {
    const userId = c.req.header('x-user-id') || 'demo-user';
    const body = c.req.valid('json');

    // If this is the first source or isDefault is true, make it default
    const existingSources = await initDB(c.env.DB)
      .select()
      .from(fundingSources)
      .where(eq(fundingSources.userId, userId));

    const shouldBeDefault = body.isDefault || existingSources.length === 0;

    // If setting as default, unset other defaults
    if (shouldBeDefault && existingSources.length > 0) {
      await initDB(c.env.DB)
        .update(fundingSources)
        .set({ isDefault: false })
        .where(eq(fundingSources.userId, userId));
    }

    const [newSource] = await initDB(c.env.DB)
      .insert(fundingSources)
      .values({
        id: crypto.randomUUID(),
        userId,
        ...body,
        isDefault: shouldBeDefault,
        status: 'PENDING',
      })
      .returning();

    return c.json({ fundingSource: newSource }, 201);
  } catch (error) {
    console.error('Error creating funding source:', error);
    return c.json({ error: 'Failed to create funding source' }, 500);
  }
});

/**
 * PATCH /v1/funding-sources/:id
 * Update a funding source
 */
fundingRouter.patch(
  '/:id',
  zValidator(
    'json',
    z.object({
      isDefault: z.boolean().optional(),
      isVerified: z.boolean().optional(),
      status: z.enum(['PENDING', 'ACTIVE', 'FAILED', 'EXPIRED']).optional(),
    })
  ),
  async (c) => {
    try {
      const id = c.req.param('id');
      const userId = c.req.header('x-user-id') || 'demo-user';
      const body = c.req.valid('json');

      // Check ownership
      const existing = await initDB(c.env.DB)
        .select()
        .from(fundingSources)
        .where(and(eq(fundingSources.id, id), eq(fundingSources.userId, userId)))
        .limit(1);

      if (!existing.length) {
        return c.json({ error: 'Funding source not found' }, 404);
      }

      // If setting as default, unset other defaults
      if (body.isDefault === true) {
        await initDB(c.env.DB)
          .update(fundingSources)
          .set({ isDefault: false })
          .where(and(eq(fundingSources.userId, userId), eq(fundingSources.id, id)));
      }

      const [updated] = await initDB(c.env.DB)
        .update(fundingSources)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(fundingSources.id, id))
        .returning();

      return c.json({ fundingSource: updated[0] });
    } catch (error) {
      console.error('Error updating funding source:', error);
      return c.json({ error: 'Failed to update funding source' }, 500);
    }
  }
);

/**
 * DELETE /v1/funding-sources/:id
 * Delete a funding source
 */
fundingRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.req.header('x-user-id') || 'demo-user';

    // Check ownership
    const existing = await initDB(c.env.DB)
      .select()
      .from(fundingSources)
      .where(and(eq(fundingSources.id, id), eq(fundingSources.userId, userId)))
      .limit(1);

    if (!existing.length) {
      return c.json({ error: 'Funding source not found' }, 404);
    }

    await initDB(c.env.DB).delete(fundingSources).where(eq(fundingSources.id, id));

    return c.newResponse(null, 204);
  } catch (error) {
    console.error('Error deleting funding source:', error);
    return c.json({ error: 'Failed to delete funding source' }, 500);
  }
});

/**
 * POST /v1/funding-sources/plaid/exchange-token
 * Exchange a Plaid public token for an access token
 */
fundingRouter.post('/plaid/exchange-token', async (c) => {
  try {
    const { publicToken, metadata } = await c.req.json();
    const userId = c.req.header('x-user-id') || 'demo-user';

    if (!publicToken) {
      return c.json({ error: 'publicToken is required' }, 400);
    }

    // TODO: Exchange public token with Plaid API
    // const plaidResponse = await plaidClient.itemPublicTokenExchange({
    //   public_token: publicToken,
    // });
    // const accessToken = plaidResponse.data.access_token;
    // const itemId = plaidResponse.data.item_id;

    // For now, return mock response
    const accessToken = 'access-sandbox-' + crypto.randomUUID();
    const itemId = 'item-sandbox-' + crypto.randomUUID();

    // Create or update funding source
    const [fundingSource] = await initDB(c.env.DB)
      .insert(fundingSources)
      .values({
        id: crypto.randomUUID(),
        userId,
        type: 'bank_account',
        provider: 'plaid',
        providerAccountId: itemId,
        institutionName: metadata?.institution?.name || 'Unknown Bank',
        accountLastFour: metadata?.account?.mask || '0000',
        accountType: metadata?.account?.type || 'checking',
        plaidAccessToken: accessToken,
        plaidItemId: itemId,
        status: 'ACTIVE',
        isVerified: true,
      })
      .returning();

    return c.json({ fundingSource }, 201);
  } catch (error) {
    console.error('Error exchanging Plaid token:', error);
    return c.json({ error: 'Failed to exchange token' }, 500);
  }
});

/**
 * POST /v1/funding-sources/plaid/create-link-token
 * Create a Plaid Link token for initializing Plaid Link
 */
fundingRouter.post('/plaid/create-link-token', async (c) => {
  try {
    // TODO: Create link token with Plaid API
    // const userId = c.req.header('x-user-id') || 'demo-user';
    // const plaidResponse = await plaidClient.linkTokenCreate({
    //   user: { client_user_id: userId },
    //   client_name: 'Tap2 Wallet',
    //   products: ['auth'],
    //   country_codes: ['US'],
    //   language: 'en',
    // });

    // For now, return mock response
    const linkToken = 'link-sandbox-' + crypto.randomUUID();

    return c.json({ linkToken });
  } catch (error) {
    console.error('Error creating Plaid link token:', error);
    return c.json({ error: 'Failed to create link token' }, 500);
  }
});
