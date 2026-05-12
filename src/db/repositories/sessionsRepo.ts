import { getPool } from '../pool';

/** Reason a session was revoked. */
export type RevocationReason = 'logout' | 'password_change' | 'admin';

/** Row shape for the `sessions` table. */
export interface SessionRow {
  jti: string;
  user_id: string;
  issued_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  revoked_reason: RevocationReason | null;
}

/** Domain-shaped session. */
export interface Session {
  jti: string;
  userId: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: RevocationReason | null;
}

/**
 * Map a raw row to the domain shape.
 * @param row The pg row.
 * @returns The mapped session.
 */
function toSession(row: SessionRow): Session {
  return {
    jti: row.jti,
    userId: row.user_id,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
  };
}

/**
 * Insert a new session row.
 * @param input Session id, owning user, and the issued/expires timestamps.
 * @returns The persisted session.
 */
export async function insertSession(input: {
  jti: string;
  userId: string;
  issuedAt: Date;
  expiresAt: Date;
}): Promise<Session> {
  const result = await getPool().query<SessionRow>(
    `INSERT INTO sessions (jti, user_id, issued_at, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING jti, user_id, issued_at, expires_at, revoked_at, revoked_reason`,
    [input.jti, input.userId, input.issuedAt, input.expiresAt],
  );
  const row = result.rows[0];
  if (!row) throw new Error('insert returned no row');
  return toSession(row);
}

/**
 * Find an active (not revoked, not expired) session by jti.
 * @param jti Session id.
 * @returns The session if active, otherwise null.
 */
export async function findActiveByJti(jti: string): Promise<Session | null> {
  const result = await getPool().query<SessionRow>(
    `SELECT jti, user_id, issued_at, expires_at, revoked_at, revoked_reason
     FROM sessions
     WHERE jti = $1 AND revoked_at IS NULL AND expires_at > now()`,
    [jti],
  );
  const row = result.rows[0];
  return row ? toSession(row) : null;
}

/**
 * Revoke a single session by jti.
 * @param jti Session id.
 * @param reason Reason for revocation.
 */
export async function revokeByJti(jti: string, reason: RevocationReason): Promise<void> {
  await getPool().query(
    `UPDATE sessions SET revoked_at = now(), revoked_reason = $2
     WHERE jti = $1 AND revoked_at IS NULL`,
    [jti, reason],
  );
}

/**
 * Revoke every still-active session belonging to a user.
 * @param userId User id.
 * @param reason Reason for revocation.
 */
export async function revokeAllForUser(
  userId: string,
  reason: RevocationReason,
): Promise<void> {
  await getPool().query(
    `UPDATE sessions SET revoked_at = now(), revoked_reason = $2
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId, reason],
  );
}
