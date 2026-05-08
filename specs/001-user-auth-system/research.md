# Phase 0 Research: User Authentication System

All `NEEDS CLARIFICATION` slots from the plan's Technical Context have been resolved. Each decision below records what was chosen, why, and what alternatives were rejected.

## 1. Session token format: JWT with server-side revocation table

- **Decision**: Issue an HS256-signed JWT on successful login. The JWT carries `sub` (user id), `jti` (random 128-bit session id), `iat`, and `exp = iat + 24h`. A row in the `sessions` table keys off `jti` and tracks `revoked_at`. The auth middleware MUST verify the signature **and** confirm the row is present and not revoked.
- **Rationale**: The user request explicitly asked for JWT, but FR-009 (immediate logout invalidation) and FR-015 (invalidate all sessions on password change) cannot be satisfied by pure stateless JWT. Storing only the `jti` in the DB keeps the token small, avoids encrypting PII into the token, and makes revocation a single indexed row update.
- **Alternatives considered**:
  - *Pure stateless JWT with a short TTL + refresh token*: rejected because it cannot honor immediate logout within the access-token TTL without the same revocation table, and complicates the spec's single-token model.
  - *Opaque session IDs only (no JWT)*: simpler, but contradicts the explicit user requirement to use JWT.
  - *JWT denylist of revoked `jti`s*: equivalent power but requires positive-list / negative-list bookkeeping; a single `sessions` table doubles as audit and is easier to clean up.

## 2. Password hashing: bcrypt at cost 12

- **Decision**: Use `bcrypt` (the Node binding) with a configurable cost factor defaulting to 12. Cost is read from `BCRYPT_COST` env var so it can be re-tuned without redeploying code paths.
- **Rationale**: User explicitly requested bcrypt. Cost 12 yields ~150–250 ms per hash on modern 2-vCPU cloud instances, which meets OWASP ASVS L2 guidance and stays under the p95 < 200 ms login budget when paired with a single hash per request.
- **Alternatives considered**:
  - *argon2id*: stronger primitive but contradicts the user's explicit bcrypt choice.
  - *scrypt*: similar tradeoffs, also contradicts the request.

## 3. Reset token format: opaque random, stored hashed

- **Decision**: Generate a 32-byte random token via `crypto.randomBytes(32)`, base64url-encode it for the email link, and store **only** its SHA-256 hash in `password_reset_requests.token_hash`. The link format is `${PUBLIC_URL}/reset?token=<base64url>`.
- **Rationale**: Opaque random tokens are simpler than signed tokens for a single-use, short-lived flow and let the spec's FR-013 ("invalidate previously issued unused links") be implemented as a single DB update. Storing only the hash means a database leak does not reveal usable reset links. Logs MUST never contain the raw token (FR-017).
- **Alternatives considered**:
  - *Signed JWT reset token*: would let the server avoid a DB lookup, but breaks single-use semantics (any valid signature works until exp) and complicates "supersede previous links".
  - *Short numeric code emailed to the user*: better for mobile UX, but the spec describes a "reset link", and codes need stricter rate-limiting to resist guessing.

## 4. Rate limiting

- **Decision**: Use `express-rate-limit` with these defaults (all numeric thresholds tunable via env):
  - `POST /auth/login`: 5 failed attempts per email per 15 minutes → 15-minute cool-down; secondary per-IP cap of 20/15 min. Successful login resets the counter.
  - `POST /auth/password-reset/request`: 3 requests per email per hour and 10 per IP per hour.
  - `POST /auth/register`: 10 per IP per hour.
- **Rationale**: Matches OWASP ASVS guidance, mirrors the user's clarification proposal (5/15 min on login), and protects FR-016 without permanently locking users out.
- **Alternatives considered**:
  - *Exponential backoff per account*: better UX under partial credential leaks but harder to reason about and to test deterministically; deferred.
  - *No application-layer rate limit, rely on WAF*: rejected because the deploy target is not guaranteed to have one.

## 5. Email transport: pluggable nodemailer

- **Decision**: Define an `EmailTransport` interface in `src/services/emailService.ts` with a single `send(message)` method. The production implementation wraps `nodemailer` configured for SMTP (creds from env). A `FileEmailTransport` writes messages to a local directory for local dev. Tests inject a `MemoryEmailTransport` that captures messages in memory for assertions.
- **Rationale**: Keeps the spec's "transactional email delivery is available" assumption out of the service code, makes integration tests deterministic, and avoids hitting a real SMTP server in CI.
- **Alternatives considered**:
  - *Direct provider SDKs (SES, SendGrid)*: lock the implementation to one vendor; deferred until a vendor is chosen.

## 6. Database access pattern: thin repositories, no ORM

- **Decision**: Use `pg` (node-postgres) directly behind hand-written repository modules in `src/db/repositories/**`. Migrations are managed by `node-pg-migrate` and live in `src/db/migrations/`.
- **Rationale**: Three tables and a fixed set of queries do not justify an ORM; thin repos keep SQL visible and make integration tests easy. Constitution principle I (Clean Code) prefers minimal dependencies.
- **Alternatives considered**:
  - *Prisma / TypeORM / Drizzle*: more boilerplate to introduce than they save at this scope, and add another type-generation step.

## 7. Input validation: zod at the HTTP boundary

- **Decision**: Each route declares a `zod` schema for body/params/query; a shared `validate(schema)` middleware parses the request and forwards a typed value, otherwise returns a 400 with a structured error.
- **Rationale**: Honors the constitution's TypeScript Strict Mode rule that data crossing the trust boundary enters as `unknown` and is narrowed by an explicit schema; gives one place to enforce the password strength policy and email normalization (lowercase + trim).
- **Alternatives considered**:
  - *`class-validator` + `class-transformer`*: requires decorator metadata and a class-per-DTO; heavier than necessary.
  - *Manual `if` chains*: violates DRY and makes the policy harder to keep in sync between register and reset.

## 8. Logging and secret redaction

- **Decision**: Use `pino` with a redaction list covering `req.body.password`, `req.body.newPassword`, `req.body.token`, `Authorization` header, and `set-cookie`. Log security events (registration, login success/failure, logout, reset request, reset completion, session expiry) with the user id (never the email or password).
- **Rationale**: Satisfies FR-017 directly. `pino` redaction is per-key and runs before serialization, so secrets never enter the log stream.
- **Alternatives considered**:
  - *Winston*: comparable, but `pino` is faster and its redaction is first-class.

## 9. Testing strategy specifics

- **Decision**:
  - *Unit*: pure functions in `services/passwordService`, `services/tokenService`, validators. No DB.
  - *Integration*: `supertest` against the Express app wired to a real Postgres started via Docker in CI (or `pg-mem` locally for fast loop). Each test truncates tables in a `beforeEach`.
  - *E2E*: one happy-path test exercising register → login → request reset → confirm reset → login with new password → old password rejected.
  - *Coverage*: Jest `coverageThreshold` enforces 80% lines and branches on `src/services/**`, `src/db/repositories/**`, `src/middleware/**`. Generated migrations and `src/index.ts` are excluded.
- **Rationale**: Matches the constitution's Testing Pyramid principle and its explicit 80% floor on business logic.
- **Alternatives considered**:
  - *Vitest*: fast and ESM-native, but the user explicitly chose Jest.
