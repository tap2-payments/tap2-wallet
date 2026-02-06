import { Router, type Response, type NextFunction } from 'express';
import { PaymentService } from '../../services/payment.service.js';
import { merchantPaymentSchema, nfcInitiateSchema, qrPaymentSchema, validateBody } from '../../utils/validation.js';
import type { MerchantPaymentInput, NFCInitiateInput, QRPaymentInput } from '../../utils/validation.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';

export const paymentsRouter = Router();
const paymentService = new PaymentService();

// POST /api/v1/payments/merchant
paymentsRouter.post('/merchant', validateBody(merchantPaymentSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // User is attached by authentication middleware
    const userId = req.user.id;
    const paymentData = req.body as MerchantPaymentInput;

    const payment = await paymentService.initiateMerchantPayment({
      userId,
      merchantId: paymentData.merchantId,
      amount: paymentData.amount,
      currency: paymentData.currency || 'USD',
      paymentMethod: paymentData.paymentMethod || 'default',
      paymentType: paymentData.paymentType || 'nfc',
      nfcNonce: paymentData.nfcNonce,
    });

    res.status(201).json(payment);
  } catch (error) {
    next(error); // Pass to error handler middleware
  }
});

// GET /api/v1/payments/:id/status
paymentsRouter.get('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const status = await paymentService.getPaymentStatus(id);
    res.json(status);
  } catch (error) {
    next(error); // Pass to error handler middleware
  }
});

// POST /api/v1/payments/nfc/initiate
paymentsRouter.post('/nfc/initiate', validateBody(nfcInitiateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Sprint 3 - Implement full NFC handshake logic with merchant verification
    // For now, return a placeholder payment ID
    const { nonce } = req.body as NFCInitiateInput;
    const paymentId = `${Date.now()}-${nonce.slice(0, 8)}`;

    res.json({
      paymentId,
      status: 'initiated',
      message: 'NFC payment initiated'
    });
  } catch (error) {
    next(error); // Pass to error handler middleware
  }
});

// POST /api/v1/payments/qr/process
paymentsRouter.post('/qr/process', validateBody(qrPaymentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Sprint 3 - Implement QR code payment logic
    // Parse QR code and process payment
    const { qrData } = req.body as QRPaymentInput;
    const paymentId = `qr-${Date.now()}`;

    res.json({
      paymentId,
      status: 'pending',
      message: 'QR payment processed'
    });
  } catch (error) {
    next(error); // Pass to error handler middleware
  }
});
