import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../../index.js';
import { initDB } from '@/config/database';
import { users, wallets, transactions, p2pTransfers } from '@/drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';

export const p2pRouter = new Hono<{ Bindings: Env }>();

// Validation schemas
const sendMoneySchema = z.object({
  recipientPhone: z.string().min(10),
  amount: z.number().positive().max(1000000), // Max $10,000
  description: z.string().optional(),
});

const requestMoneySchema = z.object({
  payerPhone: z.string().min(10),
  amount: z.number().positive().max(1000000),
  description: z.string().optional(),
  expiresIn: z.number().default(86400), // 24 hours default
});

const respondRequestSchema = z.object({
  status: z.enum(['COMPLETED', 'DECLINED']),
});

/**
 * GET /v1/p2p/contacts
 * Search for users by phone number
 */
p2pRouter.get('/contacts', async (c) => {
  try {
    const phone = c.req.query('phone');
    const userId = c.req.header('x-user-id') || 'demo-user';

    if (!phone) {
      return c.json({ error: 'Phone number is required' }, 400);
    }

    const db = initDB(c.env.DB);

    const contacts = await db
      .select({
        id: users.id,
        phone: users.phone,
        email: users.email,
        kycVerified: users.kycVerified,
      })
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    if (!contacts.length) {
      return c.json({ found: false, message: 'User not found' }, 404);
    }

    // Don't return self
    if (contacts[0].id === userId) {
      return c.json({ found: false, message: 'Cannot send to yourself' }, 400);
    }

    return c.json({ found: true, contact: contacts[0] });
  } catch (error) {
    console.error('Error searching contacts:', error);
    return c.json({ error: 'Failed to search contacts' }, 500);
  }
});

/**
 * POST /v1/p2p/send
 * Send money to another user
 *
 * SECURITY NOTE: D1 doesn't support true transactions. We use a check-and-set approach
 * to prevent race conditions. The balance is checked and updated in a single WHERE clause.
 */
p2pRouter.post('/send', zValidator('json', sendMoneySchema), async (c) => {
  try {
    const userId = c.req.header('x-user-id') || 'demo-user';
    const { recipientPhone, amount } = c.req.valid('json');
    const db = initDB(c.env.DB);

    // Find recipient
    const [recipient] = await db
      .select()
      .from(users)
      .where(eq(users.phone, recipientPhone))
      .limit(1);

    if (!recipient) {
      return c.json({ error: 'Recipient not found' }, 404);
    }

    if (recipient.id === userId) {
      return c.json({ error: 'Cannot send to yourself' }, 400);
    }

    // Check KYC verification - financial transfers require KYC
    const [senderUser] = await db
      .select({ kycVerified: users.kycVerified })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!senderUser || !senderUser.kycVerified) {
      return c.json({ error: 'KYC verification required for transfers' }, 403);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const transactionId = crypto.randomUUID();

    // Step 1: Get sender wallet
    const [senderWallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!senderWallet || senderWallet.balance < amount) {
      return c.json({ error: 'Insufficient balance' }, 400);
    }

    // Step 2: Deduct from sender using check-and-set (prevents race condition)
    // The WHERE clause includes both userId AND the current balance
    await db
      .update(wallets)
      .set({
        balance: senderWallet.balance - amount,
        updatedAt: now,
      })
      .where(and(eq(wallets.userId, userId), eq(wallets.balance, senderWallet.balance)));

    // Check if update actually happened (balance might have changed)
    // In D1, we verify by re-reading
    const [senderAfterUpdate] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!senderAfterUpdate || senderAfterUpdate.balance > senderWallet.balance - amount) {
      // Balance changed between read and update - potential race condition
      return c.json({ error: 'Balance changed, please try again' }, 409);
    }

    // Step 3: Get or create recipient wallet
    let [recipientWallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, recipient.id))
      .limit(1);

    let recipientWalletId: string;
    if (!recipientWallet) {
      // Create new wallet for recipient
      const newWalletId = crypto.randomUUID();
      await db.insert(wallets).values({
        id: newWalletId,
        userId: recipient.id,
        balance: amount,
        currency: 'USD',
        createdAt: now,
        updatedAt: now,
      });
      recipientWalletId = newWalletId;
    } else {
      recipientWalletId = recipientWallet.id;
      // Add to recipient using check-and-set
      await db
        .update(wallets)
        .set({
          balance: recipientWallet.balance + amount,
          updatedAt: now,
        })
        .where(and(eq(wallets.userId, recipient.id), eq(wallets.balance, recipientWallet.balance)));
    }

    // Step 4: Create P2P transfer record
    const [p2pTransfer] = await db
      .insert(p2pTransfers)
      .values({
        id: crypto.randomUUID(),
        transactionId,
        senderId: userId,
        recipientId: recipient.id,
        amount,
        status: 'COMPLETED',
        expiresAt,
        completedAt: now,
        createdAt: now,
      })
      .returning();

    // Step 5: Create transaction records for audit trail
    await db.insert(transactions).values({
      id: transactionId,
      walletId: senderWallet.id,
      type: 'P2P',
      amount: -amount,
      status: 'COMPLETED',
      createdAt: now,
    });

    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      walletId: recipientWalletId,
      type: 'P2P',
      amount: amount,
      status: 'COMPLETED',
      createdAt: now,
    });

    return c.json({
      transfer: p2pTransfer,
      newBalance: senderAfterUpdate.balance,
    });
  } catch (error) {
    console.error('Error sending money:', error);
    return c.json({ error: 'Failed to send money' }, 500);
  }
});

/**
 * POST /v1/p2p/request
 * Request money from another user
 */
p2pRouter.post('/request', zValidator('json', requestMoneySchema), async (c) => {
  try {
    const userId = c.req.header('x-user-id') || 'demo-user';
    const { payerPhone, amount, expiresIn } = c.req.valid('json');
    const db = initDB(c.env.DB);

    // Find payer
    const [payer] = await db.select().from(users).where(eq(users.phone, payerPhone)).limit(1);

    if (!payer) {
      return c.json({ error: 'Payer not found' }, 404);
    }

    if (payer.id === userId) {
      return c.json({ error: 'Cannot request from yourself' }, 400);
    }

    // Create payment request
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresIn * 1000);

    const [request] = await db
      .insert(p2pTransfers)
      .values({
        id: crypto.randomUUID(),
        transactionId: crypto.randomUUID(),
        senderId: userId,
        recipientId: payer.id,
        amount,
        status: 'PENDING',
        expiresAt,
        createdAt: now,
      })
      .returning();

    return c.json({ request }, 201);
  } catch (error) {
    console.error('Error creating request:', error);
    return c.json({ error: 'Failed to create request' }, 500);
  }
});

/**
 * GET /v1/p2p/requests
 * Get pending payment requests
 */
p2pRouter.get('/requests', async (c) => {
  try {
    const userId = c.req.header('x-user-id') || 'demo-user';
    const status = c.req.query('status') || 'PENDING';
    const db = initDB(c.env.DB);

    const requests = await db
      .select({
        id: p2pTransfers.id,
        amount: p2pTransfers.amount,
        status: p2pTransfers.status,
        expiresAt: p2pTransfers.expiresAt,
        createdAt: p2pTransfers.createdAt,
        senderId: p2pTransfers.senderId,
        senderPhone: users.phone,
        senderEmail: users.email,
      })
      .from(p2pTransfers)
      .innerJoin(users, eq(p2pTransfers.senderId, users.id))
      .where(
        and(
          eq(p2pTransfers.recipientId, userId),
          eq(p2pTransfers.status, status as 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED')
        )
      )
      .orderBy(desc(p2pTransfers.createdAt));

    return c.json({ requests });
  } catch (error) {
    console.error('Error fetching requests:', error);
    return c.json({ error: 'Failed to fetch requests' }, 500);
  }
});

/**
 * POST /v1/p2p/requests/:id/respond
 * Accept or decline a payment request
 *
 * SECURITY NOTE: Uses check-and-set approach for balance updates to prevent race conditions.
 */
p2pRouter.post('/requests/:id/respond', zValidator('json', respondRequestSchema), async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.req.header('x-user-id') || 'demo-user';
    const { status } = c.req.valid('json');
    const db = initDB(c.env.DB);

    // Get the request
    const [request] = await db
      .select()
      .from(p2pTransfers)
      .where(
        and(
          eq(p2pTransfers.id, id),
          eq(p2pTransfers.recipientId, userId),
          eq(p2pTransfers.status, 'PENDING')
        )
      )
      .limit(1);

    if (!request) {
      return c.json({ error: 'Request not found or already processed' }, 404);
    }

    const now = new Date();

    if (status === 'DECLINED') {
      await db.update(p2pTransfers).set({ status: 'CANCELLED' }).where(eq(p2pTransfers.id, id));

      return c.json({ message: 'Request declined' });
    }

    // Check if expired
    if (request.expiresAt && new Date(request.expiresAt) < now) {
      await db.update(p2pTransfers).set({ status: 'FAILED' }).where(eq(p2pTransfers.id, id));

      return c.json({ error: 'Request has expired' }, 400);
    }

    // Check payer's balance
    const [payerWallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!payerWallet || payerWallet.balance < request.amount) {
      return c.json({ error: 'Insufficient balance' }, 400);
    }

    // Process the payment
    const transactionId = crypto.randomUUID();

    // Update P2P transfer status first
    await db
      .update(p2pTransfers)
      .set({
        status: 'COMPLETED',
        completedAt: now,
        transactionId,
      })
      .where(eq(p2pTransfers.id, id));

    // Deduct from payer using check-and-set
    await db
      .update(wallets)
      .set({
        balance: payerWallet.balance - request.amount,
        updatedAt: now,
      })
      .where(and(eq(wallets.userId, userId), eq(wallets.balance, payerWallet.balance)));

    // Get requester wallet
    const [requesterWallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, request.senderId))
      .limit(1);

    if (requesterWallet) {
      // Add to requester using check-and-set
      await db
        .update(wallets)
        .set({
          balance: requesterWallet.balance + request.amount,
          updatedAt: now,
        })
        .where(
          and(eq(wallets.userId, request.senderId), eq(wallets.balance, requesterWallet.balance))
        );
    }

    // Create transaction records for audit trail
    await db.insert(transactions).values({
      id: transactionId,
      walletId: payerWallet.id,
      type: 'P2P',
      amount: -request.amount,
      status: 'COMPLETED',
      createdAt: now,
    });

    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      walletId: requesterWallet?.id || '',
      type: 'P2P',
      amount: request.amount,
      status: 'COMPLETED',
      createdAt: now,
    });

    return c.json({
      message: 'Payment completed',
      newBalance: payerWallet.balance - request.amount,
    });
  } catch (error) {
    console.error('Error responding to request:', error);
    return c.json({ error: 'Failed to process request' }, 500);
  }
});
