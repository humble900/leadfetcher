import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getEnv } from './env.js';
import * as schema from '../db/schema.js';

const { Pool } = pg;

let _pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: getEnv().DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return _pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export async function closeDb() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
