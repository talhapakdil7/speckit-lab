import { ValidationError } from '../lib/errors';
import { findUserByEmail, insertUser } from '../db/repositories/usersRepo';
import { hash, isStrong } from './passwordService';
import { startSession, type SessionResponseLike } from './sessionService';

/** Public response payload returned by {@link register}. */
export interface RegistrationResult extends SessionResponseLike {
  /** Newly-created user, in the OpenAPI `UserResponse` shape. */
  user: { id: string; email: string };
}

/**
 * Register a new account and immediately issue a 24-hour session.
 *
 * Workflow:
 * 1. Validate password strength (FR-003).
 * 2. Hash the password with bcrypt (FR-005).
 * 3. Insert the row; the unique constraint on `email_normalized` makes
 *    duplicate detection race-free (FR-004).
 * 4. Start a session and return token + expiry + user.
 * @param input The validated, normalized registration input.
 * @returns The session token, expiry, and the new user.
 * @throws {ValidationError} when the password fails the strength policy.
 * @throws {EmailTakenError} when the email is already registered.
 * @example
 * const { token, expiresAt, user } = await register({ email, password });
 */
export async function register(input: {
  email: string;
  password: string;
}): Promise<RegistrationResult> {
  if (!isStrong(input.password)) {
    throw new ValidationError('Password failed strength policy.', [
      {
        path: 'password',
        message:
          'Password must be 8-200 characters and contain at least one non-alphabetic character.',
      },
    ]);
  }

  const passwordHash = await hash(input.password);
  const user = await insertUser({
    emailNormalized: input.email,
    emailDisplay: input.email,
    passwordHash,
  });
  // Defensive: surface a sane error if a rare duplicate slips past the catch.
  if (!user) {
    const existing = await findUserByEmail(input.email);
    if (!existing) throw new Error('register: insert returned no user');
  }

  const session = await startSession(user.id);
  return {
    ...session,
    user: { id: user.id, email: user.emailNormalized },
  };
}
