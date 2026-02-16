import { Hono } from 'hono';
import type { Env } from '../../index.js';
import { PaymentService } from '../../services/payment.service.js';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const paymentsRouter = new Hono<{ Bindings: Env }>();

const paymentService = new PaymentService();

// Validation schemas
const merchantPaymentSchema = z.object({
  merchantId: z.string().min(1),
  amount: z.number().positive(), // Amount in cents
  currency: z.string().default('USD'),
  paymentMethod: z.string().optional(),
  paymentType: z.enum(['nfc', 'qr']).default('nfc'),
  nfcNonce: z.string().optional(),
});

const nfcInitiateSchema = z.object({
  nonce: z.string().min(1),
});

const qrPaymentSchema = z.object({
  qrData: z.string().min(1),
});

// POST /api/v1/payments/merchant
paymentsRouter.post('/merchant', zValidator('json', merchantPaymentSchema), async (c) => {
  try {
    // TODO: Get userId from auth middleware
    const userId = c.req.header('x-user-id') || 'demo-user';
    const paymentData = c.req.valid('json');

    const db = c.env.DB;
    const payment = await paymentService.initiateMerchantPayment(db, {
      userId,
      merchantId: paymentData.merchantId,
      amount: paymentData.amount, // Already in cents
      currency: paymentData.currency || 'USD',
      paymentMethod: paymentData.paymentMethod || 'default',
      paymentType: paymentData.paymentType || 'nfc',
      nfcNonce: paymentData.nfcNonce,
    });

    return c.json(payment, 201);
  } catch (error) {
    const statusCode =
      error instanceof Error && error.message === 'Insufficient wallet balance' ? 400 : 500;
    return c.json({ error: error instanceof Error ? error.message : 'Payment failed' }, statusCode);
  }
});

// GET /api/v1/payments/:id/status
paymentsRouter.get('/:id/status', async (c) => {
  try {
    const id = c.req.param('id');
    const db = c.env.DB;
    const status = await paymentService.getPaymentStatus(db, id);

    return c.json(status);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to get payment status' },
      404
    );
  }
});

// POST /api/v1/payments/nfc/initiate
paymentsRouter.post('/nfc/initiate', zValidator('json', nfcInitiateSchema), async (c) => {
  try {
    // TODO: Sprint 3 - Implement full NFC handshake logic with merchant verification
    const { nonce } = c.req.valid('json');
    const paymentId = `${Date.now()}-${nonce.slice(0, 8)}`;

    return c.json({
      paymentId,
      status: 'initiated',
      message: 'NFC payment initiated',
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'NFC initiation failed' }, 500);
  }
});

// POST /api/v1/payments/qr/process
paymentsRouter.post('/qr/process', zValidator('json', qrPaymentSchema), async (c) => {
  try {
    // TODO: Sprint 3 - Implement QR code payment logic
    const { qrData } = c.req.valid('json');
    const paymentId = `qr-${Date.now()}`;

    return c.json({
      paymentId,
      status: 'pending',
      message: 'QR payment processed',
      qrData,
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'QR payment failed' }, 500);
  }
});
