import { Hono } from 'hono';
import type { Env } from '../../index.js';
import { healthCheck } from '../../config/database.js';

export const healthRouter = new Hono<{ Bindings: Env }>();

healthRouter.get('/', async (c) => {
  const dbHealth = await healthCheck(c.env.DB);

  return c.json({
    status: dbHealth ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    database: dbHealth ? 'connected' : 'disconnected',
  });
});

healthRouter.get('/db', async (c) => {
  const dbHealth = await healthCheck(c.env.DB);

  if (dbHealth) {
    return c.json({ status: 'ok', database: 'connected' });
  }

  return c.json({ status: 'error', database: 'disconnected' }, 503);
});
