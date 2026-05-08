---
description: "Task list for User Authentication System (feature 001-user-auth-system)"
---

# Tasks: User Authentication System

**Input**: Design documents from `/specs/001-user-auth-system/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-api.openapi.yaml, quickstart.md

**Tests**: REQUIRED. The project constitution (principle III, NON-NEGOTIABLE) mandates the testing pyramid with ≥80% line/branch coverage on business logic. Test tasks are first-class deliverables in every story.

**Organization**: Tasks are grouped by user story (from `spec.md`) so each story can be implemented, tested, and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (touches a different file and depends only on already-completed tasks)
- **[Story]**: Maps a task to a specific user story (US1 / US2 / US3). Setup, Foundational, and Polish phases carry no story label.
- Every implementation task names an exact file path under the layout in `plan.md`.

## Path Conventions

Single Node/TypeScript backend project per `plan.md` "Structure Decision":

- Source: `src/...`
- Tests: `tests/unit/`, `tests/integration/`, `tests/e2e/`
- Migrations: `src/db/migrations/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the empty repository into a runnable, lint-clean, type-checked Node + TypeScript project that matches the constitution's tooling baseline.

- [ ] T001 Create the directory skeleton from `plan.md` (`src/{config,db/{migrations,repositories},services,routes,middleware,lib}`, `tests/{unit,integration,e2e,integration/helpers}`) so subsequent tasks have stable paths.
- [ ] T002 Initialize the npm project: write `package.json` with Node 20 engine, `tsconfig.json` enabling every strict flag listed in constitution principle II, `.nvmrc` pinning Node 20, and `.gitignore` (node_modules, dist, coverage, .env, tmp/emails).
- [ ] T003 Install runtime deps in `package.json` and lock: `express`, `pg`, `bcrypt`, `jsonwebtoken`, `zod`, `express-rate-limit`, `nodemailer`, `pino`, `pino-http`, `node-pg-migrate`, `dotenv`.
- [ ] T004 Install dev deps in `package.json` and lock: `typescript`, `ts-node-dev`, `@types/node`, `@types/express`, `@types/bcrypt`, `@types/jsonwebtoken`, `@types/pg`, `@types/nodemailer`, `jest`, `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`, `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-jsdoc`, `prettier`, `eslint-config-prettier`.
- [ ] T005 [P] Configure ESLint + Prettier: write `.eslintrc.cjs` enabling `@typescript-eslint/recommended`, `plugin:jsdoc/recommended-typescript`, and `eslint-config-prettier`; write `.prettierrc.json`; add `.eslintignore` and `.prettierignore`.
- [ ] T006 [P] Configure Jest in `jest.config.ts`: `ts-jest` preset, projects for `unit`, `integration`, `e2e`, `coverageThreshold` of 80% lines and 80% branches scoped to `src/services/**`, `src/db/repositories/**`, `src/middleware/**` (excluding `src/index.ts` and `src/db/migrations/**`).
- [ ] T007 [P] Add npm scripts to `package.json`: `dev` (ts-node-dev `src/index.ts`), `build` (tsc), `start` (node dist/index.js), `lint`, `format`, `format:check`, `typecheck`, `test`, `test:unit`, `test:integration`, `test:e2e`, `db:migrate`, `db:migrate:create`.
- [ ] T008 [P] Author `.env.example` listing every variable read by the app (`DATABASE_URL`, `JWT_SECRET`, `BCRYPT_COST`, `PUBLIC_URL`, `SMTP_URL`, `PORT`) with safe defaults from `quickstart.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting infrastructure that every user story depends on (config loading, DB pool, logger, error model, validation middleware, rate-limit middleware, app wiring, auth middleware shell, schema migrations). Until this phase is green, no user story can ship.

**⚠️ CRITICAL**: No work in Phase 3+ may start until every task here is complete and `npm run typecheck && npm run lint && npm test` passes against an empty business surface.

- [ ] T009 Implement typed env loader in `src/config/env.ts`: zod schema → exported `Env` object; throws on startup if any required var is missing or `JWT_SECRET` is shorter than 32 bytes.
- [ ] T010 [P] Implement pino logger in `src/lib/logger.ts` with redaction paths for `req.headers.authorization`, `req.body.password`, `req.body.newPassword`, `req.body.token`, `res.headers["set-cookie"]` (FR-017).
- [ ] T011 [P] Define domain error hierarchy in `src/lib/errors.ts`: base `DomainError` plus `ValidationError`, `InvalidCredentialsError`, `EmailTakenError`, `UnauthenticatedError`, `ResetTokenInvalidError`, `RateLimitedError`, each with a stable `code` matching the OpenAPI `ErrorResponse.error.code` enum.
- [ ] T012 [P] Implement Postgres pool factory in `src/db/pool.ts`: reads `DATABASE_URL` from `Env`, exports a singleton `Pool`, exposes `withTransaction(fn)` helper used by reset-confirmation.
- [ ] T013 Author migration `src/db/migrations/001_users.sql` creating `users (id UUID PK, email_normalized TEXT UNIQUE NOT NULL, email_display TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_login_at TIMESTAMPTZ NULL)` per `data-model.md`.
- [ ] T014 Author migration `src/db/migrations/002_sessions.sql` creating `sessions (jti UUID PK, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, issued_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ NULL, revoked_reason TEXT NULL CHECK (revoked_reason IN ('logout','password_change','admin')))` and `INDEX (user_id, expires_at)`.
- [ ] T015 Author migration `src/db/migrations/003_password_reset_requests.sql` creating `password_reset_requests (id UUID PK, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash BYTEA NOT NULL UNIQUE, issued_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ NULL, superseded_at TIMESTAMPTZ NULL)` and partial index `(user_id) WHERE consumed_at IS NULL AND superseded_at IS NULL`.
- [ ] T016 [P] Implement zod validation middleware in `src/middleware/validate.ts`: factory `validate(schema)` that parses `req.body`/`req.query`/`req.params`, attaches the typed result to `req.valid`, and throws `ValidationError` with `details[]` on failure.
- [ ] T017 [P] Implement central error handler in `src/middleware/errorHandler.ts`: maps every `DomainError` subclass to its HTTP status (400/401/409/410/429), returns the OpenAPI `ErrorResponse` shape, logs the error via the redacted logger, and never leaks stack traces in production.
- [ ] T018 [P] Implement rate-limit middleware factory in `src/middleware/rateLimit.ts` using `express-rate-limit`: exports `loginLimiter`, `registerLimiter`, `resetRequestLimiter` with thresholds tunable via env (defaults from `research.md` §4); on limit hit it MUST throw `RateLimitedError` with `Retry-After` set, satisfying FR-016.
- [ ] T019 [P] Implement `requireSession` middleware in `src/middleware/requireSession.ts`: verifies the `Authorization: Bearer <jwt>` header, decodes via `tokenService`, looks up the `sessions` row by `jti`, asserts `revoked_at IS NULL` and `expires_at > now()`, attaches `req.user = { id }`; throws `UnauthenticatedError` otherwise.
- [ ] T020 Wire the Express application in `src/app.ts`: `pino-http`, JSON body parser with 100 KB limit, mount routers (registered in later phases via `app.use`), then mount `errorHandler` last; export `createApp(deps)` so tests can inject a test pool/transport.
- [ ] T021 Implement process entry point in `src/index.ts`: load env, build pool, build app via `createApp`, listen on `Env.PORT`, install SIGTERM handler that drains the pool.
- [ ] T022 [P] Implement test DB helper in `tests/integration/helpers/testDb.ts`: connects to a Postgres instance via `TEST_DATABASE_URL`, runs migrations once per Jest run, exposes `truncateAll()` to be called from `beforeEach`.
- [ ] T023 [P] Implement test app helper in `tests/integration/helpers/testApp.ts`: builds the app via `createApp` with the test pool and an in-memory email transport, returns a `supertest` agent.

**Checkpoint**: `npm run typecheck`, `npm run lint`, and `npm test` all pass against the still-empty business surface; user-story phases may now begin in parallel.

---

## Phase 3: User Story 1 - Register a new account with email and password (Priority: P1) 🎯 MVP

**Goal**: A new visitor can POST `/auth/register` with email + password, the account is persisted, and the response contains a usable 24-hour JWT session that grants access to `/auth/me`.

**Independent Test**: Run `tests/e2e/register.test.ts`: register a fresh email, hit `/auth/me` with the returned token, expect 200 and the same email; register the same email again, expect 409.

### Tests for User Story 1

> Write these tests FIRST and confirm they fail before the implementation tasks below.

- [ ] T024 [P] [US1] Unit tests in `tests/unit/passwordService.test.ts`: covers `hash()` produces a bcrypt string at the configured cost, `verify()` returns true for the correct password and false for a wrong one, `isStrong()` accepts compliant passwords and rejects too-short / all-letters samples (FR-003, FR-005).
- [ ] T025 [P] [US1] Unit tests in `tests/unit/tokenService.test.ts`: `issue({ userId, jti })` returns a JWT whose decoded `sub`/`jti`/`iat`/`exp` match expectations and `exp - iat === 24 * 3600` (FR-008); `verify()` rejects tampered tokens and tokens signed with a different secret.
- [ ] T026 [P] [US1] Integration test in `tests/integration/auth.register.test.ts`: covers acceptance scenarios 1–4 of US1 — happy path (201 + token + 200 on `/auth/me`), duplicate email returns 409 with code `email_taken`, weak password returns 400, malformed email returns 400.
- [ ] T027 [P] [US1] Integration test in `tests/integration/auth.register.rateLimit.test.ts`: 11 register attempts from the same IP in one hour; the 11th MUST receive 429 with a `Retry-After` header (FR-016).

### Implementation for User Story 1

- [ ] T028 [P] [US1] Implement `passwordService` in `src/services/passwordService.ts` exporting `hash(plain)`, `verify(plain, hash)`, `isStrong(plain)`, with JSDoc per constitution principle IV.
- [ ] T029 [P] [US1] Implement `tokenService` in `src/services/tokenService.ts` exporting `issue({ userId, jti })` and `verify(token)` using `jsonwebtoken` HS256 and `Env.JWT_SECRET`; never log the token.
- [ ] T030 [P] [US1] Implement `usersRepo` in `src/db/repositories/usersRepo.ts` exporting `insert({ emailNormalized, emailDisplay, passwordHash })`, `findByEmail(emailNormalized)`, `updatePasswordHash(userId, hash)`, `touchLastLogin(userId)`. All queries parameterized.
- [ ] T031 [P] [US1] Implement `sessionsRepo` in `src/db/repositories/sessionsRepo.ts` exporting `insert({ jti, userId, issuedAt, expiresAt })`, `findActiveByJti(jti)` (returns row only when `revoked_at IS NULL` and `expires_at > now()`), `revokeByJti(jti, reason)`, `revokeAllForUser(userId, reason)`.
- [ ] T032 [P] [US1] Define request schema in `src/routes/schemas/registerSchema.ts`: zod object `{ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(8).max(200) }` matching the OpenAPI `RegisterRequest` (FR-002, FR-003).
- [ ] T033 [US1] Implement `registrationService` in `src/services/registrationService.ts` exporting `register({ email, password })`: normalizes email, calls `passwordService.isStrong` (throws `ValidationError`), `passwordService.hash`, `usersRepo.insert` (catches Postgres unique_violation → throws `EmailTakenError`), then `sessionService.start(userId)` and returns `{ token, expiresAt, user }` (FR-001, FR-004, FR-005). Depends on T028, T030, T035.
- [ ] T034 [US1] Implement `sessionService` shell in `src/services/sessionService.ts` exporting `start(userId)`: generates a UUID `jti`, computes `expiresAt = now + 24h`, calls `sessionsRepo.insert`, calls `tokenService.issue`, returns `{ token, expiresAt }` (FR-008). Depends on T029, T031.
- [ ] T035 [US1] Mount `POST /auth/register` and `GET /auth/me` in `src/routes/authRoutes.ts` (and `src/routes/meRoutes.ts`): apply `registerLimiter` + `validate(registerSchema)` to register; apply `requireSession` to `/auth/me`; both call `registrationService.register` / a `meService.fetch(req.user.id)` respectively. Depends on T033, T019, T018.
- [ ] T036 [US1] Wire the auth router into `createApp` in `src/app.ts` so the new endpoints are reachable.

**Checkpoint**: User Story 1 is independently demoable — `curl` register → 201, then `/auth/me` with the returned bearer token → 200; duplicate email → 409; weak password → 400.

---

## Phase 4: User Story 2 - Sign in to an existing account and stay signed in for 24 hours (Priority: P1)

**Goal**: An existing user can POST `/auth/login` with valid credentials and receive a 24-hour JWT; invalid credentials return a generic 401; the session expires after 24 hours; explicit `POST /auth/logout` invalidates the session immediately.

**Independent Test**: Run `tests/e2e/loginLogout.test.ts`: register → logout invalidates the original token → login with the same credentials → `/auth/me` works → mock the clock 25 h forward → `/auth/me` returns 401 with code `unauthenticated`.

### Tests for User Story 2

- [ ] T037 [P] [US2] Unit tests in `tests/unit/sessionService.test.ts`: covers `start()` produces 24-hour `expiresAt`, `revoke(jti)` marks the row revoked, `isActive(jti)` returns false after revocation and false past `expires_at` (FR-008, FR-009).
- [ ] T038 [P] [US2] Integration test in `tests/integration/auth.login.test.ts`: acceptance scenarios 1–4 of US2 — valid credentials → 200 + token + accessible `/auth/me`; invalid password → 401 with code `invalid_credentials` and identical message to "unknown email" path; clock-mocked 24 h elapsed → 401; valid mid-window → 200.
- [ ] T039 [P] [US2] Integration test in `tests/integration/auth.logout.test.ts`: acceptance scenario 5 of US2 — login, call `POST /auth/logout` → 204, then call `/auth/me` with the same token → 401.
- [ ] T040 [P] [US2] Integration test in `tests/integration/auth.login.rateLimit.test.ts`: 6 wrong-password attempts on the same email within 15 minutes → 6th returns 429 with `Retry-After`; a successful login resets the counter (FR-016).

### Implementation for User Story 2

- [ ] T041 [P] [US2] Define request schema in `src/routes/schemas/loginSchema.ts`: zod object identical in shape to register but typed separately for clarity.
- [ ] T042 [US2] Extend `sessionService` in `src/services/sessionService.ts` with `revoke(jti, reason)` and `revokeAllForUser(userId, reason)` delegating to `sessionsRepo` (supports FR-009 and FR-015). Depends on T031, T034.
- [ ] T043 [US2] Implement `loginService` in `src/services/loginService.ts` exporting `login({ email, password })`: looks up user, runs `passwordService.verify` even when the user is not found (constant-time-ish to keep timing roughly equal), throws `InvalidCredentialsError` with the same message in both not-found and bad-password branches (FR-007), on success calls `usersRepo.touchLastLogin` then `sessionService.start`. Depends on T028, T030, T034.
- [ ] T044 [US2] Mount `POST /auth/login` in `src/routes/authRoutes.ts` with `loginLimiter` + `validate(loginSchema)` + handler calling `loginService.login`; on success the limiter MUST be reset for that key. Depends on T043, T018.
- [ ] T045 [US2] Mount `POST /auth/logout` in `src/routes/authRoutes.ts` behind `requireSession`; handler calls `sessionService.revoke(req.user.jti, 'logout')` and returns 204. Depends on T042, T019.

**Checkpoint**: User Stories 1 and 2 together deliver the full sign-up / sign-in / sign-out / session-expiry slice.

---

## Phase 5: User Story 3 - Reset a forgotten password via email (Priority: P2)

**Goal**: A user can POST `/auth/password-reset/request` and (if their email is registered) receive a single-use reset link valid for 1 hour. POSTing the token + new password to `/auth/password-reset/confirm` updates the password atomically and revokes every existing session for that user.

**Independent Test**: Run `tests/e2e/passwordReset.test.ts`: register → request reset → grab the token from the in-memory email transport → confirm with a new password → old password rejected, new password works, any pre-existing session token rejected.

### Tests for User Story 3

- [ ] T046 [P] [US3] Unit tests in `tests/unit/resetService.test.ts`: covers token generation length (≥32 bytes) and hash storage (raw token never returned in responses), redemption rejects expired / consumed / superseded tokens (FR-012, FR-013), and "request for unknown email" returns success without sending (FR-010).
- [ ] T047 [P] [US3] Integration test in `tests/integration/auth.passwordReset.test.ts`: acceptance scenarios 1–5 of US3 — registered email gets an email and a 202; unregistered email gets the same 202 and no email; valid token + strong password → 204 and login with new password works; reused/expired/superseded token → 410 with code `reset_token_invalid`; successful reset revokes existing sessions (FR-015).
- [ ] T048 [P] [US3] Integration test in `tests/integration/auth.passwordReset.rateLimit.test.ts`: 4 reset requests for the same email within an hour → 4th returns 429 with `Retry-After` (FR-016).
- [ ] T049 [P] [US3] Unit test in `tests/unit/logger.redaction.test.ts`: feeds objects containing `password`, `newPassword`, `token`, and an `Authorization` header into the pino logger and asserts each is replaced with `[Redacted]` in the serialized output (FR-017).

### Implementation for User Story 3

- [ ] T050 [P] [US3] Implement `resetRequestsRepo` in `src/db/repositories/resetRequestsRepo.ts`: `insert({ userId, tokenHash, issuedAt, expiresAt })`, `findRedeemable(tokenHash)` (returns row only when `consumed_at IS NULL AND superseded_at IS NULL AND expires_at > now()`), `markConsumed(id)`, `supersedeAllForUser(userId)`.
- [ ] T051 [P] [US3] Define `EmailTransport` interface and implementations in `src/services/emailService.ts`: `SmtpEmailTransport` (nodemailer), `FileEmailTransport` (writes to `./tmp/emails/`), `MemoryEmailTransport` (test); a `buildResetEmail({ to, link })` template renders subject + plain-text body that contains the link.
- [ ] T052 [P] [US3] Define request schemas in `src/routes/schemas/resetSchemas.ts`: `resetRequestSchema` `{ email }` and `resetConfirmSchema` `{ token: z.string().min(32).max(64), newPassword: z.string().min(8).max(200) }` matching the OpenAPI components.
- [ ] T053 [US3] Implement `resetService.requestReset({ email })` in `src/services/resetService.ts`: looks up user; if absent returns success silently (FR-010); if present supersedes any prior unused requests (FR-013), generates a 32-byte random token, stores SHA-256 hash with 1 h expiry (FR-012), sends email via the injected transport with link `${Env.PUBLIC_URL}/reset?token=<base64url>`. Raw token MUST NEVER appear in logs (FR-017). Depends on T050, T051.
- [ ] T054 [US3] Implement `resetService.confirmReset({ token, newPassword })` in `src/services/resetService.ts`: enforces `passwordService.isStrong`, hashes the supplied token, runs a single `withTransaction` that calls `resetRequestsRepo.findRedeemable` (throws `ResetTokenInvalidError` on miss), `resetRequestsRepo.markConsumed`, `usersRepo.updatePasswordHash`, and `sessionsRepo.revokeAllForUser(userId, 'password_change')` (FR-014, FR-015). Depends on T028, T030, T031, T050, T012.
- [ ] T055 [US3] Mount `POST /auth/password-reset/request` and `POST /auth/password-reset/confirm` in `src/routes/authRoutes.ts` with `resetRequestLimiter` + the relevant zod schemas; both handlers always return the OpenAPI-defined status (202 / 204) on success and rely on `errorHandler` for 410/429. Depends on T053, T054, T018.

**Checkpoint**: All three user stories are individually demoable and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Items that span stories and complete the constitution gates.

- [ ] T056 [P] Run `quickstart.md` end-to-end against a fresh clone (Docker Postgres, `npm test`, manual `curl` happy path) and capture any drift in the doc.
- [ ] T057 [P] Add a single end-to-end test in `tests/e2e/happyPath.test.ts` exercising register → login → request reset → confirm reset → login with new password → old password rejected (mirrors quickstart §6).
- [ ] T058 [P] Generate and check in JSDoc lint report; ensure every exported symbol in `src/services/**`, `src/middleware/**`, and `src/db/repositories/**` has `@param`, `@returns`, `@throws` (constitution principle IV).
- [ ] T059 Confirm Jest coverage report shows ≥80% lines AND ≥80% branches on `src/services/**`, `src/db/repositories/**`, `src/middleware/**`; raise targeted unit tests for any gaps.
- [ ] T060 Add CI workflow at `.github/workflows/ci.yml` that runs `npm run lint && npm run typecheck && npm test`, services a Postgres 16 container, fails on coverage threshold breach (matches Engineering Constraints in the constitution).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; T001 first, then T002, then T003/T004 in parallel, then T005–T008 in parallel.
- **Foundational (Phase 2)**: depends on Setup; BLOCKS all user-story phases.
- **User stories (Phases 3–5)**: each depends only on Foundational; once Phase 2 is done they can run in parallel by different developers.
- **Polish (Phase 6)**: depends on all desired user-story phases.

### Within Each User Story

- Tests are written FIRST and MUST fail before the matching implementation tasks land.
- Repos before services; services before route mounts; route mount before user-facing curl/e2e demo.

### Cross-Story Dependencies

- US2 reuses `sessionService` and `passwordService` introduced in US1 (T028, T034). Either implement US1 first, or have the US2 developer stub these and rebase once US1 lands.
- US3 reuses `usersRepo`, `sessionsRepo`, and `passwordService` introduced in US1 (T028, T030, T031) plus `sessionService.revokeAllForUser` extended in US2 (T042). US3 should land after US1; it can land in parallel with US2 if developers coordinate the `sessionService` interface.

### Parallel Opportunities

- Phase 1: T005, T006, T007, T008 in parallel after T002.
- Phase 2: T010, T011, T012 in parallel after T009; T013–T015 in parallel; T016, T017, T018, T019 in parallel after T009/T011; T022, T023 in parallel after T012.
- Phase 3 (US1): T024, T025, T026, T027 in parallel before any implementation; T028, T029, T030, T031, T032 in parallel after their tests fail.
- Phase 4 (US2): T037, T038, T039, T040 in parallel; T041 in parallel with T042.
- Phase 5 (US3): T046, T047, T048, T049 in parallel; T050, T051, T052 in parallel.
- Phase 6: T056, T057, T058 in parallel.

---

## Parallel Example: Bringing User Story 1 to a green test run

```bash
# Step 1 — write the failing tests in parallel
Task: "tests/unit/passwordService.test.ts"
Task: "tests/unit/tokenService.test.ts"
Task: "tests/integration/auth.register.test.ts"
Task: "tests/integration/auth.register.rateLimit.test.ts"

# Step 2 — implement leaf modules in parallel
Task: "src/services/passwordService.ts"
Task: "src/services/tokenService.ts"
Task: "src/db/repositories/usersRepo.ts"
Task: "src/db/repositories/sessionsRepo.ts"
Task: "src/routes/schemas/registerSchema.ts"

# Step 3 — wire the orchestrators (sequential, share files)
Task: "src/services/sessionService.ts"
Task: "src/services/registrationService.ts"
Task: "src/routes/authRoutes.ts + src/app.ts"
```

---

## Implementation Strategy

### MVP scope (recommended first cut)

User Story 1 only: registration + immediately-usable session + `/auth/me`. Delivers a demoable account-creation flow and proves the bcrypt + JWT + sessions table chain works end-to-end. Phases 1 → 2 → 3, then stop and validate.

### Incremental delivery

1. Phases 1 + 2 → foundation green.
2. Phase 3 (US1) → MVP demo.
3. Phase 4 (US2) → full sign-in + session lifecycle.
4. Phase 5 (US3) → password recovery shipped.
5. Phase 6 → CI, docs, coverage gate.

### Parallel team strategy

After Phase 2 completes, three developers can take US1, US2, and US3 simultaneously, coordinating only on the `sessionService` interface (T034 + T042) and the auth router file (T035, T044, T045, T055), which should be merged carefully.

---

## Notes

- `[P]` tasks touch different files and have no incomplete dependencies; they may be assigned to different developers or run by an LLM in parallel.
- Every `[USx]` task is traceable back to a user story in `spec.md`.
- Tests are NOT optional in this project — constitution principle III blocks any merge that drops business-logic coverage below 80%.
- Commit after each task or each tight group; the `git` extension's `after_implement` hook can auto-commit when enabled in `.specify/extensions/git/git-config.yml`.
- Open clarifications: rate-limit thresholds in FR-016 are still qualitative in `spec.md` — the implementation tasks above use the working defaults from `research.md` §4 (5 failed logins / account / 15 min, 20 / IP / 15 min, 10 register / IP / hour, 3 reset-request / email / hour); finalize via `/speckit.clarify` before merging the rate-limit tests if stricter numbers are required.
