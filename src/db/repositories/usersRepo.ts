import { getPool } from '../pool';
import { EmailTakenError } from '../../lib/errors';

/** Row shape for the `users` table. */
export interface UserRow {
  id: string;
  email_normalized: string;
  email_display: string;
  password_hash: string;
  created_at: Date;
  last_login_at: Date | null;
}

/** Domain-shaped user object used by services. */
export interface User {
  id: string;
  emailNormalized: string;
  emailDisplay: string;
  passwordHash: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

/**
 * Convert a raw row to the domain shape.
 * @param row The pg row.
 * @returns The mapped user.
 */
function toUser(row: UserRow): User {
  return {
    id: row.id,
    emailNormalized: row.email_normalized,
    emailDisplay: row.email_display,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

/**
 * Insert a new user row.
 * @param input Email components and the bcrypt hash.
 * @returns The persisted user.
 * @throws {EmailTakenError} when the normalized email already exists.
 */
export async function insertUser(input: {
  emailNormalized: string;
  emailDisplay: string;
  passwordHash: string;
}): Promise<User> {
  try {
    const result = await getPool().query<UserRow>(
      `INSERT INTO users (email_normalized, email_display, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email_normalized, email_display, password_hash, created_at, last_login_at`,
      [input.emailNormalized, input.emailDisplay, input.passwordHash],
    );
    const row = result.rows[0];
    if (!row) throw new Error('insert returned no row');
    return toUser(row);
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new EmailTakenError();
    }
    throw err;
  }
}

/**
 * Find a user by normalized email.
 * @param emailNormalized Lowercased, trimmed email.
 * @returns The user or null.
 */
export async function findUserByEmail(emailNormalized: string): Promise<User | null> {
  const result = await getPool().query<UserRow>(
    `SELECT id, email_normalized, email_display, password_hash, created_at, last_login_at
     FROM users WHERE email_normalized = $1`,
    [emailNormalized],
  );
  const row = result.rows[0];
  return row ? toUser(row) : null;
}

/**
 * Update the bcrypt hash for an existing user.
 * @param userId User id.
 * @param newHash New bcrypt hash.
 */
export async function updatePasswordHash(userId: string, newHash: string): Promise<void> {
  await getPool().query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, userId]);
}

/**
 * Bump the last-login timestamp.
 * @param userId User id.
 */
export async function touchLastLogin(userId: string): Promise<void> {
  await getPool().query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [userId]);
}

/**
 * Detect a Postgres unique-violation error (SQLSTATE 23505).
 * @param err The thrown value.
 * @returns Whether the error is a unique violation.
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}
