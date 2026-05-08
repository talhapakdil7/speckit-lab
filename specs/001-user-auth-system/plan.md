# Implementation Plan: User Authentication System

**Branch**: `001-user-auth-system` | **Date**: 2026-05-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-user-auth-system/spec.md`

## Summary

Deliver an Express.js + TypeScript HTTP service that implements email/password registration, sign-in with a 24-hour authenticated session, explicit sign-out, and email-driven password reset, backed by PostgreSQL. Passwords are hashed with bcrypt; sessions are represented as JWTs whose `jti` is tracked in a server-side `sessions` table so logout and password-change invalidation are honored despite JWT's stateless nature. Reset tokens are opaque random values stored only as hashes. Jest provides unit and integration coverage to meet the constitution's ≥80% business-logic threshold.

## Technical Context

**Language/Version**: TypeScript 5.4 on Node.js 20 LTS  
**Primary Dependencies**: Express 4, `pg` (node-postgres), `bcrypt`, `jsonwebtoken`, `zod` (request validation), `express-rate-limit`, `nodemailer`, `pino` (logging), `node-pg-migrate` (schema migrations)  
**Storage**: PostgreSQL 16 (single database, three tables: `users`, `sessions`, `password_reset_requests`)  
**Testing**: Jest 29 + `ts-jest`; `supertest` for HTTP integration; `pg-mem` or a Dockerized Postgres for integration tests  
**Target Platform**: Linux container (Node 20), behind a TLS-terminating reverse proxy  
**Project Type**: Single backend HTTP service (no frontend in scope)  
**Performance Goals**: p95 < 200 ms for `/auth/login` and `/auth/register` at 100 RPS on a single 2-vCPU instance; bcrypt cost tuned so a single hash takes 150–250 ms on the target instance  
**Constraints**: All endpoints stateless w.r.t. process memory (no in-process session cache); secrets (JWT signing key, SMTP creds, DB URL) read only from env vars; logs MUST never contain plaintext passwords or full reset tokens  
**Scale/Scope**: Initial target 10k registered users, 1k DAU, single-region deploy; horizontal scaling via additional Node instances sharing the same PostgreSQL

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Clean Code | PASS | Each route handler delegates to a single-purpose service function; no handler exceeds the 30-line / complexity-10 budget. ESLint + Prettier wired into CI. |
| II. TypeScript Strict Mode | PASS | `tsconfig.json` enables every strict flag listed in the constitution; `any` is forbidden, validated inputs cross trust boundary as `unknown` then narrowed via `zod` schemas. |
| III. Testing Pyramid (NON-NEGOTIABLE) | PASS | Unit tests cover password hashing, token issuance, reset-token verification, and validators; integration tests cover each HTTP endpoint against a real Postgres; one end-to-end "register → login → reset → login" happy path. Coverage threshold 80% lines/branches enforced by Jest config and CI. |
| IV. JSDoc Documentation | PASS | `eslint-plugin-jsdoc` enforced; every exported function/type in `src/services/**`, `src/routes/**`, and `src/lib/**` documented with `@param`, `@returns`, `@throws`, plus `@example` on public entry points. |

**Result**: PASS — no Complexity Tracking entries required.

**Post-Design re-check (after Phase 1)**: PASS — the data model, contracts, and module layout introduced in Phase 1 do not add a fifth language, do not weaken strict typing, and keep all business logic (password hashing, session lifecycle, reset flow) in independently testable service modules. Coverage budget remains feasible.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-auth-system/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── auth-api.openapi.yaml   # Phase 1 output
├── checklists/
│   └── requirements.md         # From /speckit.specify
└── tasks.md             # Created later by /speckit.tasks
```

### Source Code (repository root)

```text
src/
├── index.ts                 # Process entry point: config, DB pool, HTTP server bootstrap
├── app.ts                   # Express app wiring (middleware, routes, error handler)
├── config/
│   └── env.ts               # Typed env-var loader (zod-validated)
├── db/
│   ├── pool.ts              # PostgreSQL connection pool factory
│   ├── migrations/          # node-pg-migrate SQL migrations
│   │   ├── 001_users.sql
│   │   ├── 002_sessions.sql
│   │   └── 003_password_reset_requests.sql
│   └── repositories/
│       ├── usersRepo.ts
│       ├── sessionsRepo.ts
│       └── resetRequestsRepo.ts
├── services/
│   ├── passwordService.ts   # bcrypt hash/verify, strength policy
│   ├── tokenService.ts      # JWT issue/verify, jti generation
│   ├── sessionService.ts    # create/revoke/lookup sessions, 24h expiry
│   ├── registrationService.ts
│   ├── loginService.ts
│   ├── resetService.ts      # request + confirm flows, token hashing
│   └── emailService.ts      # nodemailer transport + reset email template
├── routes/
│   ├── authRoutes.ts        # /auth/register, /login, /logout, /password-reset/*
│   └── meRoutes.ts          # /auth/me (protected example)
├── middleware/
│   ├── requireSession.ts    # Verifies JWT and active session row
│   ├── rateLimit.ts         # express-rate-limit configs per endpoint
│   ├── validate.ts          # zod schema → 400 mapping
│   └── errorHandler.ts      # Maps domain errors to HTTP status + safe payload
└── lib/
    ├── errors.ts            # Domain error types
    └── logger.ts            # pino logger (redaction rules for secrets)

tests/
├── unit/
│   ├── passwordService.test.ts
│   ├── tokenService.test.ts
│   ├── sessionService.test.ts
│   └── resetService.test.ts
├── integration/
│   ├── auth.register.test.ts
│   ├── auth.login.test.ts
│   ├── auth.logout.test.ts
│   ├── auth.passwordReset.test.ts
│   └── helpers/
│       ├── testDb.ts        # Spins up Postgres, runs migrations, truncates between tests
│       └── testApp.ts       # Builds the Express app against the test DB
└── e2e/
    └── happyPath.test.ts    # register → login → reset → login again
```

**Structure Decision**: Single backend HTTP service (no frontend deliverable in this feature). The repository root holds one Node/TypeScript project; routes are thin, all business logic lives in `src/services/**` so it can be unit-tested without HTTP, and persistence is isolated in `src/db/repositories/**` so services can be tested with in-memory fakes when useful. This layout maps directly to the constitution's testing pyramid and 80% coverage requirement on business logic.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

_No violations — table intentionally empty._
