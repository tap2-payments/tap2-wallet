import { Router } from 'express';
import { healthRouter } from './health.js';
import { walletRouter } from './wallet.js';
import { paymentsRouter } from './payments.js';

export const apiV1Router = Router();

// Mount sub-routers
apiV1Router.use('/health', healthRouter);
apiV1Router.use('/wallet', walletRouter);
apiV1Router.use('/payments', paymentsRouter);
