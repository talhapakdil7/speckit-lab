import type { NextFunction, Request, Response } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { ValidationError, type ValidationIssue } from '../lib/errors';

/** Request portion to validate. */
export type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Augment the Express request with the parsed, typed payload so handlers can
 * read `req.valid` instead of casting from `req.body`.
 */
declare module 'express-serve-static-core' {
  interface Request {
    valid?: unknown;
  }
}

/**
 * Build an Express middleware that parses one section of the request through a
 * zod schema. On success the parsed value is attached to `req.valid` and the
 * next middleware runs. On failure a {@link ValidationError} is forwarded to
 * the error handler with structured per-field details.
 * @param schema The zod schema to apply.
 * @param target Which part of the request to validate. Defaults to body.
 * @returns An Express middleware.
 * @example
 * router.post('/auth/register', validate(registerSchema), handler);
 */
export function validate<T>(
  schema: ZodSchema<T>,
  target: ValidationTarget = 'body',
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, _res, next) => {
    const input = req[target] as unknown;
    const result = schema.safeParse(input);
    if (!result.success) {
      next(new ValidationError('Request failed validation.', toIssues(result.error)));
      return;
    }
    req.valid = result.data;
    next();
  };
}

/**
 * Convert a {@link ZodError} into the {@link ValidationIssue} array shape used
 * in the OpenAPI ErrorResponse.
 * @param err The zod error to convert.
 * @returns A flat list of validation issues.
 */
function toIssues(err: ZodError): ValidationIssue[] {
  return err.issues.map((i) => ({
    path: i.path.join('.') || '(root)',
    message: i.message,
  }));
}
