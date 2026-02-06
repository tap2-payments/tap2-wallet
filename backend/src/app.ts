import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './middleware/logger.js';
import { authenticate } from './middleware/auth.js';
import { apiV1Router } from './routes/v1/index.js';

export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS - Configure from environment variable or use defaults
  // Format: CORS_ORIGINS=https://example.com,https://app.example.com
  const corsOriginsEnv = process.env.CORS_ORIGINS;
  const allowedOrigins = corsOriginsEnv
    ? corsOriginsEnv.split(',').map(origin => origin.trim())
    : process.env.NODE_ENV === 'production'
      ? ['https://tap2wallet.com', 'https://app.tap2wallet.com']
      : ['http://localhost:3000', 'http://localhost:19006', 'http://localhost:8081'];

  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
  }));

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(morgan('combined', { stream: logger }));

  // Health check (no auth required)
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes with authentication (except for public endpoints like auth)
  // Note: For now, auth is stubbed - will be fully implemented in Sprint 1 (Auth0 integration)
  app.use('/api/v1', authenticate, apiV1Router);

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}
