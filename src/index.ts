import { createApp } from './app';
import { loadEnv } from './config/env';
import { _resetPoolForTests, getPool } from './db/pool';
import { logger } from './lib/logger';

/**
 * Process entry point. Loads env, ensures the pool is warm, starts the HTTP
 * server, and installs a SIGTERM handler that drains the pool.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  // Eagerly create the pool so misconfiguration surfaces at startup.
  getPool();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'auth service listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutdown requested');
    server.close(async () => {
      await _resetPoolForTests();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  logger.error({ err }, 'failed to start');
  process.exit(1);
});
