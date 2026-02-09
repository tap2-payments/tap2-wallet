import { describe, it, expect, beforeEach, vi } from 'vitest';
import { healthRouter } from '../health.js';
import type { Env } from '../../../index.js';

// Mock D1 database
const mockDB = {
  prepare: vi.fn().mockReturnThis(),
  first: vi.fn(),
} as unknown as D1Database;

const mockEnv = {
  DB: mockDB,
  KV: {} as KVNamespace,
  R2: {} as R2Bucket,
  ENVIRONMENT: 'test',
} satisfies Env;

// Create a properly typed mock statement
function createMockStatement(firstResult: unknown) {
  return {
    first: vi.fn().mockResolvedValue(firstResult),
  } as unknown as D1PreparedStatement;
}

describe('Health Check API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/health', () => {
    it('should return 200 OK status when database is connected', async () => {
      vi.mocked(mockDB.prepare).mockReturnValue(createMockStatement({ '?column?': 1 }));

      const request = new Request('http://localhost/api/v1/health');
      const ctx = {
        req: request,
        env: mockEnv,
      };
      const response = await healthRouter.fetch(request, ctx);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toMatchObject({
        status: 'ok',
        database: 'connected',
      });
      expect(body).toHaveProperty('timestamp');
    });

    it('should return error status when database is disconnected', async () => {
      vi.mocked(mockDB.prepare).mockReturnValue(
        createMockStatement(Promise.reject(new Error('Connection refused')))
      );

      const request = new Request('http://localhost/api/v1/health');
      const response = await healthRouter.fetch(request, { env: mockEnv });

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toMatchObject({
        status: 'error',
        database: 'disconnected',
      });
    });
  });

  describe('GET /api/v1/health/db', () => {
    it('should return 200 OK when database is connected', async () => {
      vi.mocked(mockDB.prepare).mockReturnValue(createMockStatement({}));

      const request = new Request('http://localhost/api/v1/health/db');
      const response = await healthRouter.fetch(request, { env: mockEnv });

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toEqual({
        status: 'ok',
        database: 'connected',
      });
    });

    it('should return 503 when database is disconnected', async () => {
      vi.mocked(mockDB.prepare).mockReturnValue(
        createMockStatement(Promise.reject(new Error('Connection refused')))
      );

      const request = new Request('http://localhost/api/v1/health/db');
      const response = await healthRouter.fetch(request, { env: mockEnv });

      expect(response.status).toBe(503);

      const body = await response.json();
      expect(body).toEqual({
        status: 'error',
        database: 'disconnected',
      });
    });
  });
});
