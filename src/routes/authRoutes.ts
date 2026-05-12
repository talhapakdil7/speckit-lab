import { Router, type Request, type Response, type NextFunction } from 'express';
import { register } from '../services/registrationService';
import { registerSchema, type RegisterInput } from './schemas/registerSchema';
import { validate } from '../middleware/validate';
import { registerLimiter } from '../middleware/rateLimit';

/**
 * Build the auth router.
 *
 * Exposes:
 * - POST /auth/register
 *
 * (Login, logout, and password-reset endpoints will be added in subsequent
 * user stories.)
 * @returns A configured Express router.
 */
export function authRouter(): Router {
  const router = Router();

  router.post(
    '/register',
    registerLimiter(),
    validate(registerSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = req.valid as RegisterInput;
        const result = await register(input);
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
