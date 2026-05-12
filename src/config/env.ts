import 'dotenv/config';
import { z } from 'zod';

/**
 * Schema describing every environment variable the application reads. Anything
 * not listed here MUST NOT be consumed elsewhere in the codebase.
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 bytes of entropy'),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  PUBLIC_URL: z.string().url(),
  SMTP_URL: z.string().min(1).default('memory://'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  RATE_LIMIT_LOGIN_PER_ACCOUNT: z.coerce.number().int().min(1).default(5),
  RATE_LIMIT_LOGIN_WINDOW_MIN: z.coerce.number().int().min(1).default(15),
  RATE_LIMIT_LOGIN_PER_IP: z.coerce.number().int().min(1).default(20),
  RATE_LIMIT_REGISTER_PER_IP_PER_HOUR: z.coerce.number().int().min(1).default(10),
  RATE_LIMIT_RESET_PER_EMAIL_PER_HOUR: z.coerce.number().int().min(1).default(3),
  RATE_LIMIT_RESET_PER_IP_PER_HOUR: z.coerce.number().int().min(1).default(10),
});

/** Parsed, validated, typed environment configuration. */
export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/**
 * Load and validate the process environment.
 * @returns The parsed env on first call; the cached parse on subsequent calls.
 * @throws {Error} if any required variable is missing or invalid.
 * @example
 * const env = loadEnv();
 * console.log(env.PORT);
 */
export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * Reset the cached env. Test-only.
 */
export function _resetEnvCacheForTests(): void {
  cached = undefined;
}
