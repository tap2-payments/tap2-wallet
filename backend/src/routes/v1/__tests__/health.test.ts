import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

describe('Health Check API', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Express app type from supertest
  let app: any;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /health', () => {
    it('should return 200 OK status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        status: 'ok',
      });
    });

    it('should return timestamp', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return 200 OK status when database is connected', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        database: 'connected',
      });
    });
  });
});
