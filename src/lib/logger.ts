import pino from 'pino';

/**
 * Application logger configured with redaction of secrets and credentials so
 * passwords, JWTs, and reset tokens never appear in log output (FR-017).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'req.body.password',
      'req.body.newPassword',
      'req.body.token',
      '*.password',
      '*.newPassword',
      '*.token',
      '*.password_hash',
      '*.passwordHash',
      'authorization',
      'password',
      'newPassword',
      'token',
    ],
    censor: '[Redacted]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
