import type { NextFunction, Request, Response } from 'express';
import { UnauthenticatedError } from '../lib/errors';
import { verifyToken } from '../services/tokenService';
import { findActiveByJti } from '../db/repositories/sessionsRepo';

/**
 * Augment Express request with the authenticated user/session, populated by
 * {@link requireSession} on success.
 */
declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; jti: string };
  }
}

/**
 * Express middleware that enforces a valid, non-revoked, non-expired session.
 * Verifies the JWT signature, then confirms the `jti` is still active in the
 * `sessions` table (FR-008, FR-009, FR-015). Throws {@link UnauthenticatedError}
 * on any failure so the central handler emits a generic 401.
 * @param req The HTTP request.
 * @param _res Unused response.
 * @param next Express next handler.
 */
export async function requireSession(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
      throw new UnauthenticatedError();
    }
    const token = header.slice(7).trim();
    let claims;
    try {
      claims = verifyToken(token);
    } catch {
      throw new UnauthenticatedError();
    }
    const session = await findActiveByJti(claims.jti);
    if (!session || session.userId !== claims.sub) {
      throw new UnauthenticatedError();
    }
    req.user = { id: claims.sub, jti: claims.jti };
    next();
  } catch (err) {
    next(err);
  }
}
