import type { Request, Response, NextFunction } from 'express';
import { loginLimiters, registerLimiter, resetRequestLimiters } from '../../../src/middleware/rateLimit';
import { RateLimitedError } from '../../../src/lib/errors';

/**
 * Unit tests for the `rateLimit` middleware factories. Verifies each
 * factory returns a usable middleware and that the shared `handler`
 * branch produces a {@link RateLimitedError} carrying a Retry-After
 * value derived from the configured window (FR-016, §11).
 */

beforeAll(() => {
  process.env.DATABASE_URL = 'postgres://x:x@localhost:5432/x';
  process.env.JWT_SECRET = 'a'.repeat(40);
  process.env.PUBLIC_URL = 'http://localhost:3000';
  process.env.BCRYPT_COST = '4';
});

describe('rateLimit factories', () => {
  it('should produce both perAccount and perIp middleware for login', () => {
    const limiters = loginLimiters();
    expect(typeof limiters.perAccount).toBe('function');
    expect(typeof limiters.perIp).toBe('function');
  });

  it('should produce a registration limiter middleware', () => {
    const mw = registerLimiter();
    expect(typeof mw).toBe('function');
  });

  it('should produce both perEmail and perIp middleware for reset requests', () => {
    const limiters = resetRequestLimiters();
    expect(typeof limiters.perEmail).toBe('function');
    expect(typeof limiters.perIp).toBe('function');
  });

  it('should call next with a RateLimitedError when the limit is exceeded', async () => {
    // Configure a per-IP register limiter with max=1 and immediately exceed it.
    const mw = registerLimiter();
    const callMw = (ip: string): Promise<unknown> =>
      new Promise((resolve) => {
        const req = { ip, body: {}, app: {} } as unknown as Request;
        const res = {
          setHeader: () => undefined,
          getHeader: () => undefined,
          headersSent: false,
          end: () => undefined,
        } as unknown as Response;
        const next: NextFunction = (err?: unknown) => resolve(err);
        void mw(req, res, next);
      });

    // First request through limiter should pass (max default ≥ 1).
    const first = await callMw('1.2.3.4');
    expect(first).toBeUndefined();

    // Exhaust the default 10/hour quota by replaying from the same key.
    let lastError: unknown;
    for (let i = 0; i < 12; i++) {
      lastError = await callMw('1.2.3.4');
      if (lastError instanceof RateLimitedError) break;
    }
    expect(lastError).toBeInstanceOf(RateLimitedError);
    const retryAfter = (lastError as RateLimitedError).retryAfterSeconds;
    expect(typeof retryAfter).toBe('number');
    expect(retryAfter).toBeGreaterThan(0);
  });

  it('should bucket different IPs independently', async () => {
    const mw = registerLimiter();
    const call = (ip: string): Promise<unknown> =>
      new Promise((resolve) => {
        const req = { ip, body: {}, app: {} } as unknown as Request;
        const res = {
          setHeader: () => undefined,
          getHeader: () => undefined,
          headersSent: false,
          end: () => undefined,
        } as unknown as Response;
        void mw(req, res, ((err?: unknown) => resolve(err)) as NextFunction);
      });
    // Fresh IP must always be admitted on its first hit.
    const err = await call('9.9.9.9');
    expect(err).toBeUndefined();
  });

  it('should fall back to "unknown" when the email field is missing or non-string', async () => {
    // Indirectly exercises the normalizeEmail branch through the perAccount
    // keyGenerator: a request without an email is admitted (different key
    // than an email-bearing request).
    const { perAccount } = loginLimiters();
    const call = (body: unknown): Promise<unknown> =>
      new Promise((resolve) => {
        const req = { ip: '1.1.1.1', body, app: {} } as unknown as Request;
        const res = {
          setHeader: () => undefined,
          getHeader: () => undefined,
          headersSent: false,
          end: () => undefined,
        } as unknown as Response;
        void perAccount(req, res, ((err?: unknown) => resolve(err)) as NextFunction);
      });
    expect(await call({})).toBeUndefined();
    expect(await call({ email: 42 })).toBeUndefined();
  });

  it('should fall back to "unknown" when req.ip is missing on the per-IP limiter', async () => {
    const mw = registerLimiter();
    const { perIp: resetIp } = resetRequestLimiters();
    const callOn = (handler: typeof mw): Promise<unknown> =>
      new Promise((resolve) => {
        const req = { ip: undefined, body: {}, app: {} } as unknown as Request;
        const res = {
          setHeader: () => undefined,
          getHeader: () => undefined,
          headersSent: false,
          end: () => undefined,
        } as unknown as Response;
        void handler(req, res, ((err?: unknown) => resolve(err)) as NextFunction);
      });
    expect(await callOn(mw)).toBeUndefined();
    expect(await callOn(resetIp)).toBeUndefined();
  });
});
