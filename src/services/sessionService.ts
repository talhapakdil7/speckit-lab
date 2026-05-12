import { randomUUID } from 'crypto';
import {
  insertSession,
  revokeAllForUser,
  revokeByJti,
  type RevocationReason,
} from '../db/repositories/sessionsRepo';
import { issueToken, SESSION_LIFETIME_MS } from './tokenService';

/** Public session payload returned to clients. */
export interface SessionResponseLike {
  /** Encoded JWT bearer token. */
  token: string;
  /** ISO-8601 expiry timestamp (issued-at + 24 h). */
  expiresAt: string;
}

/**
 * Start a new session for `userId`: generate a `jti`, persist a row, and issue
 * a 24-hour JWT bound to that `jti` (FR-008).
 * @param userId Owner of the session.
 * @returns The encoded token and its expiry.
 * @example
 * const session = await startSession(user.id);
 */
export async function startSession(userId: string): Promise<SessionResponseLike> {
  const jti = randomUUID();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + SESSION_LIFETIME_MS);
  await insertSession({ jti, userId, issuedAt, expiresAt });
  const issued = issueToken({ userId, jti });
  return issued;
}

/**
 * Revoke a single session immediately (FR-009).
 * @param jti Session id.
 * @param reason Reason recorded for audit.
 */
export async function revokeSession(jti: string, reason: RevocationReason = 'logout'): Promise<void> {
  await revokeByJti(jti, reason);
}

/**
 * Revoke every active session for `userId` (FR-015).
 * @param userId User whose sessions should be invalidated.
 * @param reason Reason recorded for audit.
 */
export async function revokeAllSessionsForUser(
  userId: string,
  reason: RevocationReason = 'password_change',
): Promise<void> {
  await revokeAllForUser(userId, reason);
}
