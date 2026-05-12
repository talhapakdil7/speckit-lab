/**
 * Stable error code emitted in the OpenAPI {@link ErrorResponse}'s `error.code`
 * field. Adding new codes requires updating the OpenAPI contract too.
 */
export type ErrorCode =
  | 'validation_failed'
  | 'invalid_credentials'
  | 'email_taken'
  | 'unauthenticated'
  | 'reset_token_invalid'
  | 'rate_limited';

/**
 * Validation issue surfaced to clients in {@link ErrorResponse.error.details}.
 */
export interface ValidationIssue {
  path: string;
  message: string;
}

/**
 * Base class for every domain-level error. The error handler middleware maps
 * subclasses to HTTP status codes and the OpenAPI error envelope.
 */
export abstract class DomainError extends Error {
  /** Machine-readable error code matching the OpenAPI enum. */
  public abstract readonly code: ErrorCode;

  /** HTTP status to emit for this error. */
  public abstract readonly status: number;

  /** Optional structured details, rendered in `error.details`. */
  public readonly details?: ValidationIssue[] | undefined;

  /**
   * Construct a domain error.
   * @param message Human-readable, end-user-safe message.
   * @param details Optional structured details.
   */
  protected constructor(message: string, details?: ValidationIssue[]) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

/** Request body / params / query failed schema validation. */
export class ValidationError extends DomainError {
  public readonly code = 'validation_failed' as const;
  public readonly status = 400;
  /**
   * @param message Human-readable summary.
   * @param details Per-field issues.
   */
  public constructor(message: string, details?: ValidationIssue[]) {
    super(message, details);
  }
}

/** Email or password rejected. Message is intentionally generic (FR-007). */
export class InvalidCredentialsError extends DomainError {
  public readonly code = 'invalid_credentials' as const;
  public readonly status = 401;
  /** Construct a generic invalid-credentials error. */
  public constructor() {
    super('Invalid email or password.');
  }
}

/** Registration attempted for an already-registered email (FR-004). */
export class EmailTakenError extends DomainError {
  public readonly code = 'email_taken' as const;
  public readonly status = 409;
  /** Construct a generic, non-enumerating email-taken error. */
  public constructor() {
    super('Unable to register with the supplied details.');
  }
}

/** Missing, invalid, expired, or revoked session. */
export class UnauthenticatedError extends DomainError {
  public readonly code = 'unauthenticated' as const;
  public readonly status = 401;
  /** Construct a generic unauthenticated error. */
  public constructor() {
    super('Authentication required.');
  }
}

/** Reset token not found, expired, consumed, or superseded. */
export class ResetTokenInvalidError extends DomainError {
  public readonly code = 'reset_token_invalid' as const;
  public readonly status = 410;
  /** Construct a generic reset-token-invalid error. */
  public constructor() {
    super('Reset link is no longer valid.');
  }
}

/** Per-key rate limit exceeded. */
export class RateLimitedError extends DomainError {
  public readonly code = 'rate_limited' as const;
  public readonly status = 429;
  /** Seconds until the next request would be accepted. */
  public readonly retryAfterSeconds: number;
  /**
   * @param retryAfterSeconds Seconds the caller should wait before retrying.
   */
  public constructor(retryAfterSeconds: number) {
    super('Too many requests. Please try again later.');
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds));
  }
}
