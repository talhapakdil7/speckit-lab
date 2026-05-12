import bcrypt from 'bcrypt';
import { loadEnv } from '../config/env';

const MIN_LENGTH = 8;
const MAX_LENGTH = 200;
const NON_ALPHA = /[^A-Za-z]/;

/**
 * Hash a plaintext password with bcrypt at the configured cost.
 * @param plain Plaintext password.
 * @returns A bcrypt hash string of the form `$2b$<cost>$<22-char-salt><31-char-hash>`.
 * @example
 * const h = await hash('correcthorse9');
 */
export async function hash(plain: string): Promise<string> {
  const cost = loadEnv().BCRYPT_COST;
  return bcrypt.hash(plain, cost);
}

/**
 * Verify a plaintext password against a previously stored bcrypt hash. Returns
 * false (rather than throwing) for malformed hashes so callers can branch
 * uniformly on the boolean.
 * @param plain Plaintext to compare.
 * @param hashValue Stored bcrypt hash.
 * @returns `true` when the password matches; `false` otherwise.
 */
export async function verify(plain: string, hashValue: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hashValue);
  } catch {
    return false;
  }
}

/**
 * Return whether a password meets the configured strength policy:
 * - at least {@link MIN_LENGTH} characters,
 * - at most {@link MAX_LENGTH} characters,
 * - contains at least one non-alphabetic character.
 * @param plain Plaintext password to test.
 * @returns `true` if the password is acceptable.
 */
export function isStrong(plain: string): boolean {
  if (typeof plain !== 'string') return false;
  if (plain.length < MIN_LENGTH || plain.length > MAX_LENGTH) return false;
  return NON_ALPHA.test(plain);
}
