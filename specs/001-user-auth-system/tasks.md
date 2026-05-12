---
description: 'Task list for User Authentication System (feature 001-user-auth-system)'
---

# Tasks: User Authentication System

**Input**: Design documents from `/specs/001-user-auth-system/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/auth-api.openapi.yaml, quickstart.md

**Tests**: Tests are **REQUIRED** per constitution Principle III (NON-NEGOTIABLE) §1 (TDD). Every implementation task in Phases 3–5 MUST be preceded by a failing test task (RED) and followed by a refactor checkpoint.

**Organization**: Tasks are grouped by user story. Stories are mapped from `spec.md`:

- **US1** = Register a new account (P1) — MVP
- **US2** = Sign in & 24-hour session, sign out (P1)
- **US3** = Password reset via email (P2)

## Format

`- [ ] [TaskID] [P?] [Story?] Description with file path`

- `[P]` — parallelizable (different files, no incomplete deps)
- `[USx]` — user-story label (Phases 3–5 only)
- File paths follow plan.md project structure.

## Path Conventions

Single backend project at repository root:

- Source: `src/**`
- Unit tests mirror `src/`: `tests/unit/<mirror>/**.test.ts`
- Integration tests grouped by feature: `tests/integration/**.test.ts`
- E2E tests grouped by user journey: `tests/e2e/**.spec.ts`
- Fixtures: `tests/fixtures/**.ts`
- Helpers: `tests/**/helpers/**.ts`

(Per constitution §3 Test Types & Organization, §4 Naming Conventions, §13 Tools & Frameworks.)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tooling baseline required by the constitution before any test or feature work.

- [X] T001 Verify project structure exists per plan.md (`src/`, `tests/unit/`, `tests/integration/`, `tests/e2e/`, `tests/fixtures/`); create any missing directories
- [X] T002 [P] Confirm `tsconfig.json` enables every strict flag listed in Principle II (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.) and `npm run typecheck` exits 0
- [X] T003 [P] Configure ESLint at repo root (`.eslintrc.cjs`) with `@typescript-eslint`, `eslint-plugin-jsdoc`, `eslint-plugin-jest`, and `eslint-config-prettier`; enforce rules `expect-expect`, `valid-expect`, `no-conditional-expect`, `no-standalone-expect`, `no-identical-title`, `no-disabled-tests` (constitution §7, §13)
- [X] T004 [P] Configure Prettier (`.prettierrc`) and verify `npm run format:check` is wired to CI
- [X] T005 Configure Jest projects in `jest.config.ts` with three projects: `unit` (`<rootDir>/tests/unit/**/*.test.ts`), `integration` (`<rootDir>/tests/integration/**/*.test.ts`), `e2e` (`<rootDir>/tests/e2e/**/*.spec.ts`); add `coverageThreshold.global = { lines: 80, branches: 75 }` (constitution §3, §13)
- [ ] T006 [P] Add Stryker config `stryker.conf.mjs` (`@stryker-mutator/core`, `@stryker-mutator/jest-runner`) with `thresholds.high=80, thresholds.low=75, thresholds.break=75`; add `test:mutation` npm script (constitution §2, §13)
- [ ] T007 [P] Install and wire `husky` + `lint-staged` pre-commit hook (`.husky/pre-commit`) running `typecheck` → `lint` → `test:unit` (constitution §13 pre-commit contract)
- [X] T008 [P] Add `.env.example` matching quickstart.md (DATABASE_URL, JWT_SECRET, BCRYPT_COST, PUBLIC_URL, SMTP_URL, PORT)

**Checkpoint**: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` all run (even with empty test suite) and exit 0.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure shared by ALL user stories. Must complete before Phase 3.

**⚠️ CRITICAL**: No user-story work begins until this phase is complete.

### Test scaffolding (built before any production code per §1 TDD)

- [X] T009 [P] Create `tests/integration/helpers/testDb.ts` — boots a disposable Postgres (testcontainers or dedicated DB), runs migrations, exposes `withTransaction()` for per-test rollback (constitution §8, §9)
- [X] T010 [P] Create `tests/integration/helpers/testApp.ts` — builds the Express app against the test DB and returns a Supertest agent
- [ ] T011 [P] Create `tests/unit/helpers/fakeUsersRepo.ts`, `tests/unit/helpers/fakeSessionsRepo.ts`, and `tests/unit/helpers/fakeResetRequestsRepo.ts` — in-memory `Map`-backed implementations of the repo interfaces (constitution §6 Fake)
- [ ] T012 [P] Create `tests/unit/helpers/fakeClock.ts` and `tests/unit/helpers/fakeEmailService.ts` (mock for nodemailer interactions) (constitution §6 Mock, Stub)
- [ ] T013 [P] Create `tests/fixtures/users.ts`, `tests/fixtures/passwords.ts` (valid/invalid samples per FR-003), and `tests/fixtures/jwts.ts` — typed constants, never mutated by tests (constitution §6 fixtures)
- [ ] T014 [P] Create `tests/unit/helpers/factories.ts` exporting `createTestUser(overrides?)`, `setupMockAPI()`, and `buildAuthenticatedAgent(agent, user)` (constitution §6 helpers)

### Database & shared infrastructure

- [X] T015 Verify SQL migrations exist and match data-model.md: `src/db/migrations/001_users.sql`, `002_sessions.sql`, `003_password_reset_requests.sql` — add any missing columns/indexes (UNIQUE `email_normalized`, `INDEX (user_id, expires_at)`, partial index on unconsumed reset rows)
- [X] T016 [P] Implement typed env loader in `src/config/env.ts` using `zod` (DATABASE_URL, JWT_SECRET ≥32 bytes, BCRYPT_COST, PUBLIC_URL, SMTP_URL, PORT)
- [X] T017 [P] Implement PostgreSQL pool factory in `src/db/pool.ts`
- [X] T018 [P] Implement domain error types in `src/lib/errors.ts` (`ValidationError`, `ConflictError`, `UnauthenticatedError`, `RateLimitedError`, `InvalidResetTokenError`)
- [X] T019 [P] Implement `pino` logger in `src/lib/logger.ts` with redaction list including `password`, `newPassword`, `token`, `Authorization`, `password_hash` (FR-017, §11)
- [X] T020 Wire base Express app in `src/app.ts` (helmet defaults, JSON body limit, request-id middleware, error handler last); leave routes empty for now
- [X] T021 [P] Add `src/middleware/errorHandler.ts` mapping domain errors → safe HTTP payloads per OpenAPI `ErrorResponse` schema
- [X] T022 [P] Add `src/middleware/validate.ts` — `zod` schema → 400 mapping helper
- [X] T023 [P] Add `src/middleware/rateLimit.ts` — per-endpoint `express-rate-limit` configs (FR-016)

**Checkpoint**: Foundation ready. App boots against test DB, helpers/fakes/fixtures available, but no auth endpoints implemented.

---

## Phase 3: User Story 1 — Register a new account (Priority: P1) 🎯 MVP

**Goal**: A visitor with a valid email and a policy-compliant password can register, be signed in, and reach `/auth/me`.

**Independent Test**: Submit registration with a fresh email/password pair → response 201 with a session token → `GET /auth/me` with that token returns the user.

> **TDD**: Every test task below MUST be written, run, and observed RED before its paired implementation task.

### RED — Unit tests for US1 (constitution §3 mirror layout)

- [X] T024 [P] [US1] Write failing unit tests for `passwordService` in `tests/unit/services/passwordService.test.ts` — strength policy (FR-003: ≥8 chars, ≥1 non-alpha), `hash()` produces bcrypt format with configured cost, `verify()` returns true/false, plaintext never returned (oracle from spec FR-003, FR-005)
- [X] T025 [P] [US1] Write failing unit tests for `tokenService` in `tests/unit/services/tokenService.test.ts` — `issue()` signs HS256 (never `alg: none`), encodes `sub`/`jti`/`iat`/`exp`, `verify()` rejects tampered signature and expired tokens (§11 token handling)
- [X] T026 [P] [US1] Write failing unit tests for `registrationService` in `tests/unit/services/registrationService.test.ts` using fakes from T011 — normalizes email (lower+trim per FR-002), persists hashed password (never plaintext), throws `ConflictError` on duplicate `email_normalized` (FR-004), throws `ValidationError` on weak password
- [X] T027 [P] [US1] Write failing unit tests for `sessionService.create()` in `tests/unit/services/sessionService.test.ts` — issues `expires_at = issued_at + 24h` (FR-008) using `fakeClock`
- [X] T028 [P] [US1] Write failing unit tests for `usersRepo` in `tests/unit/db/repositories/usersRepo.test.ts` using a fake/mocked `pg` client — `findByEmailNormalized`, `insert`, `updateLastLoginAt`
- [X] T029 [P] [US1] Write failing unit tests for the register-route zod schema in `tests/unit/routes/schemas/registerSchema.test.ts` — accepts valid input, rejects each documented violation (invalid email, short password, missing fields) per OpenAPI `RegisterRequest`

### RED — Integration tests for US1 (group by feature; §3, §10)

- [X] T030 [US1] Write failing integration test `tests/integration/auth.register.test.ts` covering OpenAPI `POST /auth/register` contract: 201 with `SessionResponse` body shape, 400 on schema violation, 409 on duplicate email, response shape matches OpenAPI (constitution §10 contract testing)
- [X] T031 [US1] Write failing integration test `tests/integration/auth.register.rateLimit.test.ts` — exceeding the limit returns 429 plus `Retry-After` header (§11)
- [X] T032 [US1] Write failing integration test `tests/integration/auth.register.security.test.ts` — registering a user never serializes `password_hash` in any response; pino log capture shows no plaintext password (FR-005, FR-017, §11)

### GREEN — Implementation for US1

- [X] T033 [P] [US1] Implement `src/services/passwordService.ts` (bcrypt hash/verify, strength policy) to make T024 pass
- [X] T034 [P] [US1] Implement `src/services/tokenService.ts` (JWT issue/verify, jti generation) to make T025 pass
- [X] T035 [P] [US1] Implement `src/db/repositories/usersRepo.ts` to make T028 pass
- [X] T036 [US1] Implement `src/services/sessionService.ts` `create()` (depends on T034) to make T027 pass
- [X] T037 [US1] Implement `src/services/registrationService.ts` (depends on T033, T035, T036) to make T026 pass
- [X] T038 [P] [US1] Implement `src/routes/schemas/registerSchema.ts` to make T029 pass
- [X] T039 [US1] Implement `POST /auth/register` handler in `src/routes/authRoutes.ts` (depends on T037, T038, T021–T023) to make T030 and T032 pass
- [X] T040 [US1] Wire `express-rate-limit` config for `/auth/register` in `src/middleware/rateLimit.ts` to make T031 pass
- [X] T041 [US1] Implement `GET /auth/me` minimum in `src/routes/meRoutes.ts` and `src/middleware/requireSession.ts` (needed by US1 independent-test criterion); write paired failing unit test for `requireSession` in `tests/unit/middleware/requireSession.test.ts` first

### REFACTOR & docs — US1

- [ ] T042 [US1] Add JSDoc with `@param`, `@returns`, `@throws`, and one `@example` to every exported symbol added in T033–T041 (constitution Principle IV)
- [ ] T043 [US1] Run mutation testing on touched files: `npm run test:mutation -- --mutate "src/services/{passwordService,tokenService,registrationService,sessionService}.ts,src/routes/schemas/registerSchema.ts"` and triage surviving mutants until score ≥ 75% (§7)

**Checkpoint**: User Story 1 fully functional and independently testable — a fresh user can register and authenticate `/auth/me`.

---

## Phase 4: User Story 2 — Sign in, 24-hour session, sign out (Priority: P1)

**Goal**: A registered user can sign in to get a 24-hour session, use `/auth/me`, and explicitly log out which immediately invalidates the session.

**Independent Test**: Register via US1 → POST `/auth/login` with same creds → 200 + token → `/auth/me` 200 → advance clock to 24h+1m → `/auth/me` 401 → register fresh user, log in, POST `/auth/logout` → `/auth/me` with that token 401.

### RED — Unit tests for US2

- [ ] T044 [P] [US2] Write failing unit tests for `loginService` in `tests/unit/services/loginService.test.ts` using fakes — returns a session on valid credentials, throws `UnauthenticatedError` (generic message) on wrong password AND on unknown email (FR-007), updates `last_login_at` on success
- [ ] T045 [P] [US2] Extend `tests/unit/services/sessionService.test.ts` — `verify(jti)` returns active session; returns null for revoked/expired rows; `revoke(jti, reason)` sets `revoked_at` and `revoked_reason` (FR-009, FR-015, §11)
- [ ] T046 [P] [US2] Write failing unit tests for `sessionsRepo` in `tests/unit/db/repositories/sessionsRepo.test.ts` — `insert`, `findByJti`, `markRevoked`, `revokeAllForUser`
- [ ] T047 [P] [US2] Write failing unit tests for `loginSchema` in `tests/unit/routes/schemas/loginSchema.test.ts` covering OpenAPI `LoginRequest`
- [ ] T048 [P] [US2] Extend `tests/unit/middleware/requireSession.test.ts` — rejects missing header, malformed bearer, expired JWT, valid JWT whose session row is revoked, valid JWT whose session row has `expires_at` in the past (FR-008, FR-009, §11 authorization negative paths)

### RED — Integration tests for US2

- [ ] T049 [US2] Write failing integration test `tests/integration/auth.login.test.ts` covering OpenAPI `POST /auth/login` — 200 with `SessionResponse`; 401 generic on wrong password; 401 generic on unknown email (assert identical body and timing class); 400 on schema violation
- [ ] T050 [US2] Write failing integration test `tests/integration/auth.login.rateLimit.test.ts` — exceeded limit returns 429 + `Retry-After` (FR-016, §11)
- [ ] T051 [US2] Write failing integration test `tests/integration/auth.login.sessionExpiry.test.ts` — using `jest.useFakeTimers()`, advance >24h after login and assert `/auth/me` returns 401 (FR-008, SC-005)
- [ ] T052 [US2] Write failing integration test `tests/integration/auth.logout.test.ts` covering OpenAPI `POST /auth/logout` — 204 on success; the same token returns 401 on `/auth/me` afterwards (FR-009); 401 when called without a session
- [ ] T053 [US2] Write failing integration test `tests/integration/auth.me.test.ts` — `GET /auth/me` returns `UserResponse` for a valid session; 401 for missing/expired/revoked

### GREEN — Implementation for US2

- [ ] T054 [P] [US2] Implement `src/db/repositories/sessionsRepo.ts` to make T046 pass
- [ ] T055 [US2] Extend `src/services/sessionService.ts` with `verify()`, `revoke()`, `revokeAllForUser()` (depends on T054) to make T045 pass
- [ ] T056 [US2] Implement `src/services/loginService.ts` (depends on T033, T034, T035, T055) to make T044 pass
- [ ] T057 [P] [US2] Implement `src/routes/schemas/loginSchema.ts` to make T047 pass
- [ ] T058 [US2] Implement `POST /auth/login` in `src/routes/authRoutes.ts` (depends on T056, T057) to make T049 and T051 pass
- [ ] T059 [US2] Wire `express-rate-limit` for `/auth/login` in `src/middleware/rateLimit.ts` to make T050 pass
- [ ] T060 [US2] Implement `POST /auth/logout` in `src/routes/authRoutes.ts` (depends on T055) to make T052 pass
- [ ] T061 [US2] Finalize `src/middleware/requireSession.ts` (depends on T055) to make T048 and T053 pass
- [ ] T062 [US2] Confirm `GET /auth/me` returns the `UserResponse` shape per OpenAPI to make T053 pass

### REFACTOR & docs — US2

- [ ] T063 [US2] Add/update JSDoc on all symbols touched in T054–T062 (Principle IV)
- [ ] T064 [US2] Run mutation testing on `src/services/{loginService,sessionService}.ts` and `src/middleware/requireSession.ts`; triage to ≥ 75% (§7)

**Checkpoint**: Stories 1 and 2 both fully functional and independently testable.

---

## Phase 5: User Story 3 — Password reset via email (Priority: P2)

**Goal**: A user can request a reset email, follow the link, set a new password, and sign in with it; old sessions are invalidated; the system never reveals whether an email is registered.

**Independent Test**: Register via US1 → POST `/auth/password-reset/request` with the email → capture token from `fakeEmailService` → POST `/auth/password-reset/confirm` → login with old password = 401 → login with new password = 200; older sessions for that account are revoked.

### RED — Unit tests for US3

- [ ] T065 [P] [US3] Write failing unit tests for `resetService.request()` in `tests/unit/services/resetService.test.ts` — issues SHA-256 hashed token with 1h expiry (FR-012), supersedes prior unused requests (FR-013), invokes `emailService.send()` only when user exists, returns the same `Ack` shape regardless (FR-010)
- [ ] T066 [P] [US3] Extend `tests/unit/services/resetService.test.ts` with `confirm()` cases — accepts unused unexpired token; rejects consumed/superseded/expired/tampered tokens with `InvalidResetTokenError`; updates `password_hash`; revokes all sessions for the user with reason `password_change` (FR-014, FR-015) — runs transactionally
- [ ] T067 [P] [US3] Write failing unit tests for `resetRequestsRepo` in `tests/unit/db/repositories/resetRequestsRepo.test.ts` — `insert`, `findByTokenHash`, `markConsumed`, `markSupersededForUser`
- [ ] T068 [P] [US3] Write failing unit tests for `emailService` in `tests/unit/services/emailService.test.ts` using a mocked nodemailer transport — sends a reset email with the token in a URL built from `PUBLIC_URL`, asserts `toHaveBeenCalledWith` shape; does NOT include plaintext password or full DB row (FR-017)
- [ ] T069 [P] [US3] Write failing unit tests for reset schemas in `tests/unit/routes/schemas/resetSchemas.test.ts` covering OpenAPI `ResetRequestRequest` and `ResetConfirmRequest`

### RED — Integration tests for US3

- [ ] T070 [US3] Write failing integration test `tests/integration/auth.passwordReset.request.test.ts` — `POST /auth/password-reset/request` returns 202 `AckResponse` for both registered and unregistered emails (FR-010); when registered, `fakeEmailService` recorded exactly one send
- [ ] T071 [US3] Write failing integration test `tests/integration/auth.passwordReset.rateLimit.test.ts` — 429 + `Retry-After` after limit (FR-016)
- [ ] T072 [US3] Write failing integration test `tests/integration/auth.passwordReset.confirm.test.ts` — happy path returns 204; replay returns 400/410; expired (>1h via fake clock) returns 400/410; superseded token returns 400/410; weak password returns 400 (FR-012, FR-013, FR-014)
- [ ] T073 [US3] Write failing integration test `tests/integration/auth.passwordReset.sessionInvalidation.test.ts` — after a successful reset, all previously issued sessions for that user fail `/auth/me` with 401 (FR-015)

### GREEN — Implementation for US3

- [ ] T074 [P] [US3] Implement `src/db/repositories/resetRequestsRepo.ts` to make T067 pass
- [ ] T075 [P] [US3] Implement `src/services/emailService.ts` (nodemailer transport, reset email template) to make T068 pass
- [ ] T076 [US3] Implement `src/services/resetService.ts` (depends on T033, T055, T074, T075) — `request()` and `confirm()`, with `confirm()` running transactionally — to make T065 and T066 pass
- [ ] T077 [P] [US3] Implement `src/routes/schemas/resetRequestSchema.ts` and `src/routes/schemas/resetConfirmSchema.ts` to make T069 pass
- [ ] T078 [US3] Implement `POST /auth/password-reset/request` and `POST /auth/password-reset/confirm` in `src/routes/authRoutes.ts` (depends on T076, T077) to make T070 and T072 pass
- [ ] T079 [US3] Wire `express-rate-limit` for both reset endpoints in `src/middleware/rateLimit.ts` to make T071 pass
- [ ] T080 [US3] Verify session invalidation behavior end-to-end via T073

### REFACTOR & docs — US3

- [ ] T081 [US3] Add/update JSDoc on all symbols touched in T074–T080 (Principle IV)
- [ ] T082 [US3] Run mutation testing on `src/services/{resetService,emailService}.ts`; triage to ≥ 75% (§7)

**Checkpoint**: All three user stories independently functional and tested.

---

## Phase 6: End-to-End Journeys

**Purpose**: Cover the highest-value cross-story journeys per constitution §3 (~10% E2E, grouped by user journey, `.spec.ts`).

- [ ] T083 [P] Write E2E test `tests/e2e/register-and-login.spec.ts` — register → call `/auth/me` → logout → login again → `/auth/me` (covers US1+US2 happy path; oracle = quickstart.md §6)
- [ ] T084 [P] Write E2E test `tests/e2e/password-reset.spec.ts` — register → request reset → consume token from `fakeEmailService` → confirm → old password fails → new password works → old session 401 (covers US3 + FR-015 across stories)
- [ ] T085 [P] Write E2E test `tests/e2e/session-expiry.spec.ts` — register → login → advance clock >24h → `/auth/me` 401 (SC-005)

> Note: The E2E tier may use Jest+Supertest until a Playwright config is added. If Playwright is adopted later, the same files (under `tests/e2e/`, `.spec.ts`) move to `playwright.config.ts` without rename.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T086 [P] Add `tests/unit/lib/logger.test.ts` asserting pino redaction of `password`, `newPassword`, `token`, `Authorization`, `password_hash` (FR-017, quickstart §7)
- [ ] T087 [P] Add OpenAPI contract-drift check: a unit test in `tests/unit/contracts/openapi.test.ts` that parses `specs/001-user-auth-system/contracts/auth-api.openapi.yaml` and asserts every documented endpoint has a registered Express route (§10)
- [ ] T088 [P] Verify global coverage ≥ 80% lines / ≥ 75% branches via `npm test -- --coverage`; raise tests for any uncovered branch in `src/services/**` or `src/middleware/**`
- [ ] T089 [P] Run full Stryker run (`npm run test:mutation`) across `src/services/**` and `src/middleware/**`; mutation score ≥ 75% (§2, §7)
- [ ] T090 [P] Audit `tests/**` for anti-patterns per §7: no `expect(x).toBe(x)`, no `.skip`/`.todo` without linked issue, no `console.log`, no test files split per source file at the unit tier (§3); fix or quarantine
- [ ] T091 Performance sanity: unit suite ≤ 60 s, integration suite ≤ 5 min on the default CI runner (§12 performance budget); profile and split any slow file
- [ ] T092 [P] Update `quickstart.md` smoke-test commands if any endpoint shape changed during implementation
- [ ] T093 Run `quickstart.md` end-to-end manually as the final acceptance gate

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: no deps; start immediately.
- **Phase 2 (Foundational)**: depends on Phase 1; BLOCKS Phases 3–5.
- **Phase 3 (US1)**: depends on Phase 2.
- **Phase 4 (US2)**: depends on Phase 2; integrates with US1's `requireSession` and `tokenService` but is independently testable (its tests register a user inline).
- **Phase 5 (US3)**: depends on Phase 2; uses `passwordService` from US1 and `sessionService.revokeAllForUser` from US2 — schedule after US2 unless those two are explicitly stubbed.
- **Phase 6 (E2E)**: depends on Phases 3–5 completing the journey it covers.
- **Phase 7 (Polish)**: depends on all desired stories being complete.

### Within each user story (TDD discipline, constitution §1)

1. RED — write tests; observe failure (`npm run test:unit -- --testPathPattern '<file>'`).
2. GREEN — implement minimum code to pass.
3. REFACTOR — clean up; JSDoc; mutation run.

### Parallel opportunities

- Phase 1: T002, T003, T004, T006, T007, T008 in parallel after T001.
- Phase 2: T009–T014 (test helpers/fixtures) all in parallel; T016–T019 and T021–T023 in parallel after T015 and T020.
- Phase 3: RED tests T024–T029 all in parallel; implementation files T033, T034, T035, T038 in parallel (different files).
- Phase 4: RED tests T044–T048 in parallel; implementation T054, T057 in parallel.
- Phase 5: RED tests T065–T069 in parallel; implementation T074, T075, T077 in parallel.
- Phase 6: T083–T085 all in parallel.
- Phase 7: T086–T090 and T092 in parallel.

### Cross-story parallelism

After Phase 2, two engineers MAY work US2 and US3 in parallel by stubbing the cross-dependency (`sessionService.revokeAllForUser` is the only one) and integrating at T080.

---

## Implementation Strategy

**MVP scope** = Phase 1 + Phase 2 + Phase 3 (US1 only). At the MVP checkpoint a fresh user can register and reach `/auth/me`. Ship this first, then layer US2 and US3.

**Incremental delivery checkpoints**:

1. After T043 — MVP: registration + protected `/auth/me`.
2. After T064 — Full P1: login, 24h session, logout.
3. After T082 — P2: password reset with session invalidation.
4. After T093 — Hardened release: contract test, coverage gate, mutation gate, quickstart green.

**Quality gates (per constitution §12, must pass on every PR)**:

- `npm run typecheck` 0 errors
- `npm run lint` 0 errors / 0 warnings
- `npm run format:check`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e` (when applicable)
- Coverage: lines ≥ 80%, branches ≥ 75%
- Mutation score ≥ 75% (on `main`; nightly elsewhere)
