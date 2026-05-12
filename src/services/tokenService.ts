import jwt from 'jsonwebtoken';
import { loadEnv } from '../config/env';

const SESSION_LIFETIME_SECONDS = 24 * 60 * 60;

/** Claims carried by the JWT issued at sign-in. */
export interface SessionClaims {
  /** User id (UUID). */
  sub: string;
  /** Session identifier (UUID); foreign key into `sessions.jti`. */
  jti: string;
  /** Issued-at, seconds since epoch. */
  iat: number;
  /** Expiry, seconds since epoch. Always `iat + 24*3600`. */
  exp: number;
}

/** Result of {@link issueToken}. */
export interface IssuedToken {
  /** Encoded JWT to send to the client. */
  token: string;
  /** ISO-8601 expiry timestamp matching the JWT `exp` claim. */
  expiresAt: string;
}

/**
 * Issue a 24-hour HS256 JWT carrying the supplied `userId` as `sub` and the
 * supplied session id as `jti`.
 * @param input The user id and session id to encode.
 * @returns The encoded token and its ISO expiry.
 * @example
 * const { token, expiresAt } = issueToken({ userId, jti });
 */
export function issueToken(input: { userId: string; jti: string }): IssuedToken {
  const env = loadEnv();
  const issuedAt = Math.floor(Date.now() / 1000);
  const expSeconds = issuedAt + SESSION_LIFETIME_SECONDS;
  const token = jwt.sign(
    { sub: input.userId, jti: input.jti, iat: issuedAt, exp: expSeconds },
    env.JWT_SECRET,
    { algorithm: 'HS256' },
  );
  return {
    token,
    expiresAt: new Date(expSeconds * 1000).toISOString(),
  };
}

/**
 * Verify a JWT and return its claims.
 * @param token Encoded JWT.
 * @returns Decoded claims.
 * @throws {jwt.JsonWebTokenError} when the signature is invalid.
 * @throws {jwt.TokenExpiredError} when the token has expired.
 */
export function verifyToken(token: string): SessionClaims {
  const env = loadEnv();
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || !decoded || typeof decoded.sub !== 'string') {
    throw new jwt.JsonWebTokenError('malformed token payload');
  }
  return decoded as unknown as SessionClaims;
}

/** Exported for symmetry / readability in callers. */
export const SESSION_LIFETIME_MS = SESSION_LIFETIME_SECONDS * 1000;
