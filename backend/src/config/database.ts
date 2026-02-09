import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../drizzle/schema.js';

/**
 * Initialize Drizzle ORM with D1 database binding
 * This is called in each Cloudflare Worker request handler
 */
export function initDB(db: D1Database) {
  return drizzle(db, { schema });
}

/**
 * Health check for database connectivity
 * For D1, this runs a simple query to verify connection
 */
export async function healthCheck(db: D1Database): Promise<boolean> {
  try {
    await db.prepare('SELECT 1').first();
    return true;
  } catch {
    return false;
  }
}

// Re-export schema for convenience
export * from '../../drizzle/schema.js';
