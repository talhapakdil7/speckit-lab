import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireSession } from '../middleware/requireSession';
import { getPool } from '../db/pool';
import { UnauthenticatedError } from '../lib/errors';

/**
 * Build the `/auth/me` router. Returns the authenticated user's id and email.
 * @returns An Express router that mounts `GET /me`.
 */
export function meRouter(): Router {
  const router = Router();

  router.get(
    '/me',
    requireSession,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) throw new UnauthenticatedError();
        const result = await getPool().query<{
          id: string;
          email_normalized: string;
        }>(`SELECT id, email_normalized FROM users WHERE id = $1`, [req.user.id]);
        const row = result.rows[0];
        if (!row) throw new UnauthenticatedError();
        res.status(200).json({ id: row.id, email: row.email_normalized });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
