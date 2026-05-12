import rateLimit, { type Options, type RateLimitRequestHandler } from 'express-rate-limit';
import type { Request } from 'express';
import { loadEnv } from '../config/env';
import { RateLimitedError } from '../lib/errors';

/**
 * Build an express-rate-limit handler that throws {@link RateLimitedError}
 * (carrying a Retry-After value) when exceeded, instead of writing a default
 * 429 directly. Lets the central error handler render the OpenAPI envelope.
 * @param windowMs Time window in milliseconds.
 * @param max Maximum requests per window per key.
 * @param keyGenerator Extracts the limiter key from a request.
 * @returns Configured express-rate-limit middleware.
 */
function build(
  windowMs: number,
  max: number,
  keyGenerator: (req: Request) => string,
): RateLimitRequestHandler {
  const opts: Partial<Options> = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (_req, _res, next, options) => {
      const retryAfterMs =
        typeof options.windowMs === 'number' ? options.windowMs : windowMs;
      next(new RateLimitedError(Math.ceil(retryAfterMs / 1000)));
    },
  };
  return rateLimit(opts);
}

/**
 * Login limiter: throttles failed-login attempts per email plus a coarser
 * per-IP cap. The route handler MUST call {@link loginLimiterByAccount}'s
 * `resetKey` on a successful login so the counter does not penalize the user
 * after they recover.
 * @returns A pair of middleware: per-account, then per-IP.
 */
export function loginLimiters(): {
  perAccount: RateLimitRequestHandler;
  perIp: RateLimitRequestHandler;
} {
  const env = loadEnv();
  const windowMs = env.RATE_LIMIT_LOGIN_WINDOW_MIN * 60 * 1000;
  const perAccount = build(
    windowMs,
    env.RATE_LIMIT_LOGIN_PER_ACCOUNT,
    (req) => `login:account:${normalizeEmail(req.body?.email)}`,
  );
  const perIp = build(
    windowMs,
    env.RATE_LIMIT_LOGIN_PER_IP,
    (req) => `login:ip:${req.ip ?? 'unknown'}`,
  );
  return { perAccount, perIp };
}

/**
 * Registration limiter: per-IP cap to slow scripted account creation.
 * @returns A configured registration limiter.
 */
export function registerLimiter(): RateLimitRequestHandler {
  const env = loadEnv();
  return build(
    60 * 60 * 1000,
    env.RATE_LIMIT_REGISTER_PER_IP_PER_HOUR,
    (req) => `register:ip:${req.ip ?? 'unknown'}`,
  );
}

/**
 * Password-reset-request limiter: per-email and per-IP caps.
 * @returns Per-email and per-IP limiters.
 */
export function resetRequestLimiters(): {
  perEmail: RateLimitRequestHandler;
  perIp: RateLimitRequestHandler;
} {
  const env = loadEnv();
  const perEmail = build(
    60 * 60 * 1000,
    env.RATE_LIMIT_RESET_PER_EMAIL_PER_HOUR,
    (req) => `reset:email:${normalizeEmail(req.body?.email)}`,
  );
  const perIp = build(
    60 * 60 * 1000,
    env.RATE_LIMIT_RESET_PER_IP_PER_HOUR,
    (req) => `reset:ip:${req.ip ?? 'unknown'}`,
  );
  return { perEmail, perIp };
}

/**
 * Normalize an email address for use as a limiter key (FR-002).
 * @param input Raw value from the request body.
 * @returns Lowercased and whitespace-trimmed email, or `unknown` for non-strings.
 */
function normalizeEmail(input: unknown): string {
  if (typeof input !== 'string') return 'unknown';
  return input.trim().toLowerCase();
}
