import type { ErrorRequestHandler } from 'express';
import { DomainError, RateLimitedError } from '../lib/errors';
import { logger } from '../lib/logger';

/**
 * Express error-handling middleware. Maps {@link DomainError} subclasses to
 * the OpenAPI error envelope and a stable HTTP status; logs everything with
 * the redacting logger so secrets cannot leak through error paths (FR-017).
 * @param err The error thrown by an upstream handler.
 * @param _req Unused request.
 * @param res The HTTP response.
 * @param _next Unused next handler; required by the Express signature.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof DomainError) {
    if (err instanceof RateLimitedError) {
      res.setHeader('Retry-After', String(err.retryAfterSeconds));
    }
    logger.warn({ code: err.code, status: err.status }, err.message);
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'An unexpected error occurred.',
    },
  });
};
