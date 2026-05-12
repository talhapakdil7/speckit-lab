import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../src/db/migrations');

let pool: Pool | undefined;
let migrated = false;

/**
 * Get (or lazily create) the Pool connected to the test database.
 * @returns A pg Pool pointed at TEST_DATABASE_URL or DATABASE_URL.
 */
export function getTestPool(): Pool {
  if (!pool) {
    const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!url) {
      throw new Error('TEST_DATABASE_URL (or DATABASE_URL) must be set for integration tests');
    }
    pool = new Pool({ connectionString: url, max: 5 });
  }
  return pool;
}

/**
 * Apply every migration once per Jest run. Idempotent thanks to
 * CREATE TABLE IF NOT EXISTS in each migration file.
 */
export async function migrateOnce(): Promise<void> {
  if (migrated) return;
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const p = getTestPool();
  // Serialize migrations across parallel Jest workers via a Postgres
  // advisory lock; concurrent `CREATE EXTENSION IF NOT EXISTS` calls
  // can otherwise race on the catalog unique index.
  const client = await p.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727274927)');
    try {
      for (const file of files) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        await client.query(sql);
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock(727274927)');
    }
  } finally {
    client.release();
  }
  migrated = true;
}

/**
 * Truncate every table the auth feature owns. Call from beforeEach.
 */
export async function truncateAll(): Promise<void> {
  const p = getTestPool();
  await p.query(
    'TRUNCATE password_reset_requests, sessions, users RESTART IDENTITY CASCADE',
  );
}

/**
 * Close the pool. Call from afterAll in suites that opened it.
 */
export async function closeTestPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    migrated = false;
  }
}
