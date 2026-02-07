import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';

// Use path alias for consistent imports across test files
vi.mock('@/config/database', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

// Import AFTER mock definition - vi.mock() is hoisted and must be declared before imports
import { prisma } from '@/config/database';
import { healthRouter } from '../health.js';

// Extract mock function for type-safe test assertions
const queryRawMock = prisma.$queryRaw as ReturnType<typeof vi.fn>;

/**
 * Creates a test app with the health router mounted
 * This tests the actual production code instead of duplicating it
 */
function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  // Mount the actual health router
  app.use('/api/v1/health', healthRouter);
  return app;
}

describe('Health Check API', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/health', () => {
    it('should return 200 OK status when database is connected', async () => {
      // Mock successful database query
      queryRawMock.mockResolvedValue([{ '?column?': 1 }]);

      const response = await request(app)
        .get('/api/v1/health')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        status: 'ok',
        database: 'connected',
      });
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
      expect(queryRawMock).toHaveBeenCalledTimes(1);
    });

    it('should return 503 Service Unavailable when database is disconnected', async () => {
      // Mock database connection failure
      queryRawMock.mockRejectedValue(new Error('Connection refused'));

      const response = await request(app)
        .get('/api/v1/health')
        .expect(503)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        status: 'error',
        database: 'disconnected',
      });
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('error');
      expect(queryRawMock).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database query error
      const dbError = new Error('Database timeout');
      queryRawMock.mockRejectedValue(dbError);

      const response = await request(app)
        .get('/api/v1/health')
        .expect(503);

      expect(response.body.error).toBe('Database timeout');
    });
  });
});
