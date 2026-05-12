import express, { type Express } from 'express';
import path from 'path';
import pinoHttp from 'pino-http';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/authRoutes';
import { meRouter } from './routes/meRoutes';

/**
 * Build the Express application. Exposed as a factory so integration tests can
 * spin up an isolated app pointed at the test database.
 * @returns A fully wired Express app, ready to be passed to `supertest` or
 *   `app.listen`.
 * @example
 * const app = createApp();
 * app.listen(3000);
 */
export function createApp(): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/auth', authRouter());
  app.use('/auth', meRouter());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Static demo UI (public/index.html). Serving from process.cwd() keeps it
  // working under both ts-node-dev and the compiled dist build.
  app.use(express.static(path.join(process.cwd(), 'public')));

  app.use(errorHandler);
  return app;
}
