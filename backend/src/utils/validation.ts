import { z } from 'zod';

/**
 * Validation schemas for API requests
 * All request bodies should be validated before processing
 */

// UUID validation
const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

// Decimal amount validation (in cents, positive, max $10,000)
const amountSchema = z.number()
  .int({ message: 'Amount must be an integer (cents)' })
  .positive({ message: 'Amount must be positive' })
  .max(1000000, { message: 'Amount cannot exceed $10,000' });

// Payment type validation
const paymentTypeSchema = z.enum(['nfc', 'qr'], {
  errorMap: () => ({ message: 'Payment type must be "nfc" or "qr"' }),
});

// Transaction type validation
const transactionTypeSchema = z.enum(['payment', 'p2p', 'fund', 'withdraw'], {
  errorMap: () => ({ message: 'Invalid transaction type' }),
});

// ==================== Payment Validations ====================

export const merchantPaymentSchema = z.object({
  merchantId: uuidSchema,
  amount: amountSchema,
  currency: z.string().length(3).default('USD'),
  paymentMethod: z.string().optional(),
  paymentType: paymentTypeSchema.optional(),
  nfcNonce: z.string().min(16).optional(),
});

export type MerchantPaymentInput = z.infer<typeof merchantPaymentSchema>;

export const qrPaymentSchema = z.object({
  qrData: z.string().startsWith('tap2://pay', { message: 'Invalid Tap2 QR code format' }),
  amount: amountSchema,
  tip: z.number().int().min(0).max(100000).default(0),
});

export type QRPaymentInput = z.infer<typeof qrPaymentSchema>;

export const nfcInitiateSchema = z.object({
  merchantId: uuidSchema,
  nonce: z.string().min(16, { message: 'Nonce must be at least 16 characters' }),
});

export type NFCInitiateInput = z.infer<typeof nfcInitiateSchema>;

// ==================== Wallet Validations ====================

export const fundWalletSchema = z.object({
  amount: amountSchema,
  paymentMethodId: uuidSchema,
});

export type FundWalletInput = z.infer<typeof fundWalletSchema>;

export const withdrawWalletSchema = z.object({
  amount: amountSchema,
  destination: z.enum(['bank', 'card']),
  bankAccountId: uuidSchema.optional(),
  paymentMethodId: uuidSchema.optional(),
});

export type WithdrawWalletInput = z.infer<typeof withdrawWalletSchema>;

// ==================== P2P Validations ====================

export const p2pTransferSchema = z.object({
  recipientId: uuidSchema,
  amount: amountSchema,
  message: z.string().max(500).optional(),
});

export type P2PTransferInput = z.infer<typeof p2pTransferSchema>;

export const p2pRequestSchema = z.object({
  recipientId: uuidSchema,
  amount: amountSchema,
  message: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
});

export type P2PRequestInput = z.infer<typeof p2pRequestSchema>;

// ==================== Auth Validations ====================
// Note: Authentication will be handled by Auth0 (see ARCHITECTURE.md)
// These schemas are for user registration data captured before Auth0 redirect

export const registerSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid phone number' }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const pinSetupSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, { message: 'PIN must be 6 digits' }),
  confirmPin: z.string().regex(/^\d{6}$/, { message: 'Confirmation PIN must be 6 digits' }),
}).refine((data) => data.pin === data.confirmPin, {
  message: 'PINs do not match',
  path: ['confirmPin'],
});

export type PinSetupInput = z.infer<typeof pinSetupSchema>;

// ==================== Payment Method Validations ====================

export const addCardSchema = z.object({
  paymentMethodId: z.string().startsWith('pm_', { message: 'Invalid Stripe payment method ID' }),
  setAsDefault: z.boolean().default(false),
});

export type AddCardInput = z.infer<typeof addCardSchema>;

// ==================== Query Validations ====================

export const transactionListSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  type: transactionTypeSchema.optional(),
});

export type TransactionListInput = z.infer<typeof transactionListSchema>;

// ==================== Validation Middleware ====================

import { type Request, type Response, type NextFunction } from 'express';

/**
 * Middleware factory that validates request body against a Zod schema
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.errors,
      });
    }

    req.body = result.data;
    next();
  };
}

/**
 * Middleware factory that validates query parameters against a Zod schema
 */
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.errors,
      });
    }

    req.query = result.data;
    next();
  };
}
