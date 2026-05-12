import { Pool, PoolClient, PoolConfig } from 'pg';
import { loadEnv } from '../config/env';

let pool: Pool | undefined;

/**
 * Build (or return the cached) PostgreSQL connection pool.
 * @param overrideConnectionString Optional explicit connection string used by
 *   tests to point at the test database.
 * @returns A singleton {@link Pool} for the process lifetime.
 * @example
 * const result = await getPool().query('SELECT 1');
 */
export function getPool(overrideConnectionString?: string): Pool {
  if (!pool) {
    const env = loadEnv();
    const config: PoolConfig = {
      connectionString: overrideConnectionString ?? env.DATABASE_URL,
      max: 10,
    };
    pool = new Pool(config);
  }
  return pool;
}

/**
 * Reset the cached pool. Test-only.
 */
export async function _resetPoolForTests(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

/**
 * Run a callback inside a single Postgres transaction. Commits on success and
 * rolls back if the callback throws.
 * @param fn Callback that receives a {@link PoolClient} bound to the transaction.
 * @returns Whatever `fn` resolves to.
 * @throws Rethrows any error raised by `fn` after rolling back.
 * @example
 * await withTransaction(async (client) => {
 *   await client.query('UPDATE users SET ...');
 *   await client.query('INSERT INTO sessions ...');
 * });
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
