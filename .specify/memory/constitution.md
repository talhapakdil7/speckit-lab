<!--
SYNC IMPACT REPORT
==================
Version change: 2.2.0 → 2.3.0
Bump rationale: MINOR. Principle III expands from 12 to 13 subsections by
  appending §13 Tools & Frameworks, which pins concrete tool choices,
  versions, npm scripts, the pre-commit hook contract, and the CI pipeline
  scope. Content is additive; no previously-binding rule is removed or
  weakened.

Modified principles:
  - III. Testing Principles (NON-NEGOTIABLE) — expanded: 12 → 13 subsections.

Added sections:
  - III §13 Tools & Frameworks

Removed sections:
  - None.

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (generic; no edit required)
  - ✅ .specify/templates/spec-template.md (no principle-specific sections)
  - ✅ .specify/templates/tasks-template.md (no edit required)
  - ✅ .github/copilot-instructions.md (defers to active plan; OK)

Follow-up TODOs:
  - TODO(RATIFICATION_DATE): Confirm whether 2026-05-08 is the official
    adoption date or if an earlier internal adoption date should be used.
  - TODO(STRYKER_SETUP): Add `@stryker-mutator/core` + `@stryker-mutator/jest-runner`
    to devDependencies; add `stryker.conf.mjs` enforcing mutationScore ≥ 75
    and an `npm run test:mutation` script.
  - TODO(E2E_FRAMEWORK): Decide between Playwright (recommended in §13) and
    keeping Jest+Supertest for the E2E tier. Update Jest config / add
    Playwright config accordingly.
  - TODO(LINT_JEST): Add `eslint-plugin-jest` to enforce §7 anti-tautology
    rules.
  - TODO(HUSKY): Add `husky` + `lint-staged` to install the pre-commit
    hook defined in §13.
  - TODO(UNIT_MIRROR): Reorganize `tests/unit/` to mirror `src/` (§3).
  - TODO(FIXTURES): Create `tests/fixtures/` and helpers (§6).
-->

# Speckit Lab Constitution

## Core Principles

### I. Clean Code

All production code MUST be readable, intention-revealing, and minimal.
Concretely:

- Names MUST describe purpose; abbreviations and single-letter identifiers are
  forbidden outside of conventional loop counters or math contexts.
- Functions MUST do one thing; target ≤ 30 logical lines and a cyclomatic
  complexity ≤ 10. Functions exceeding these limits MUST be refactored or
  carry a written justification in code review.
- No commented-out code, dead code, or `TODO` without a tracked issue ID.
- Duplication MUST be eliminated once a third occurrence appears (rule of three).
- Linter and formatter MUST run in CI and block merges on violations.

**Rationale**: Clean code reduces defect rates, accelerates onboarding, and
makes every other principle (testing, typing, documentation) cheaper to uphold.

### II. TypeScript Strict Mode

All TypeScript MUST compile under `"strict": true` with the following compiler
flags also enabled and never silently disabled:

- `strict`, `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`,
  `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`,
  `alwaysStrict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `exactOptionalPropertyTypes`.
- `any` is forbidden in committed code. Use `unknown` plus narrowing, or a
  precise type. Each unavoidable `any` MUST carry an inline lint-disable
  comment with a reason and a linked issue.
- `@ts-ignore` is forbidden; `@ts-expect-error` MAY be used only with an
  explanatory comment and a removal plan.
- Public module exports MUST have explicit return types; inferred returns are
  permitted only for non-exported internals.

**Rationale**: Strict typing eliminates a large class of runtime errors at
compile time and turns the type system into executable documentation.

### III. Testing Principles (NON-NEGOTIABLE)

Testing is the primary safety net for this codebase. The thirteen subsections
below are binding and apply to all production code: a Node.js 20, TypeScript,
Express, and PostgreSQL stack exercised through Jest and Supertest.

#### 1. Testing Philosophy

- Test-Driven Development (TDD) is the default workflow. The RED → GREEN →
  REFACTOR cycle MUST be followed for all new business logic:
  1. **RED**: Write a failing test that captures the next required behavior.
  2. **GREEN**: Write the minimum production code that makes it pass.
  3. **REFACTOR**: Clean up production and test code while keeping tests green.
- Tests MUST be written **before** the implementation under test exists or
  before the change is made. Pull requests that introduce new behavior with
  no preceding failing test (visible in the diff or commit history) MUST be
  rejected.
- Tests MUST be derived from the feature **specification** (`spec.md`,
  `contracts/*.openapi.yaml`, acceptance criteria) — not from reading the
  implementation back to itself. Mirror-tests that simply restate the code
  are forbidden.

**Rationale**: TDD keeps design pressure on the production code, prevents
post-hoc rationalization of behavior, and ensures every feature ships with a
regression net.

#### 2. Coverage Requirements

- Test distribution MUST approximate the testing pyramid:
  - **~70% unit tests** — pure functions, services, domain logic, validators,
    token/password helpers. No network, filesystem, or real database.
  - **~20% integration tests** — HTTP routes via Supertest, repositories
    against a real PostgreSQL test database, middleware composition.
  - **~10% end-to-end tests** — only the highest-value user workflows
    (e.g. register → login → access protected resource → logout).
- Static analysis MUST pass in CI: **TypeScript `tsc --noEmit` under strict
  mode** and **ESLint** with `@typescript-eslint` + `eslint-plugin-jsdoc`,
  zero errors and zero warnings.
- Coverage thresholds, measured by Jest (`--coverage`) and enforced in CI:
  - **≥ 80% lines**
  - **≥ 75% branches**
  - **≥ 75% mutation score** via Stryker Mutator
    (`@stryker-mutator/core` + `@stryker-mutator/jest-runner`).
- Coverage and mutation thresholds MUST fail the build when not met.
  Lowering a threshold requires a constitution amendment.
- Generated code, migrations, and trivial DTO/type-only files MAY be
  excluded from coverage but MUST be explicitly listed in the Jest and
  Stryker configurations.

**Rationale**: Line and branch coverage detect missing assertions; mutation
score detects assertions that fail to fail. Together with the pyramid, they
keep the suite fast, meaningful, and trustworthy.

#### 3. Test Types & Organization

- Tests MUST live under `tests/` and use Jest **projects** to separate tiers:
  - **Unit**: `tests/unit/**/*.test.ts` — the directory layout under
    `tests/unit/` MUST mirror the structure of `src/`
    (e.g. `src/services/passwordService.ts` →
    `tests/unit/services/passwordService.test.ts`).
  - **Integration**: `tests/integration/**/*.test.ts` — files MUST be
    grouped by **feature/route** rather than by source file
    (e.g. `tests/integration/auth.register.test.ts`,
    `tests/integration/auth.register.rateLimit.test.ts`).
  - **E2E**: `tests/e2e/**/*.spec.ts` — files MUST be grouped by
    **user journey** (e.g. `tests/e2e/register-and-login.spec.ts`,
    `tests/e2e/password-reset.spec.ts`).
- **One unit test file per source file**: every non-trivial module in `src/`
  MUST have exactly one corresponding `.test.ts` file at the mirrored path.
  Splitting a single source file's tests across multiple files is forbidden;
  use nested `describe` blocks instead.
- Shared test helpers MUST live under `tests/**/helpers/` and MUST NOT
  contain hidden assertions.
- The Jest `testMatch` patterns in each project configuration MUST match the
  globs above exactly, so that `npm run test:unit`, `npm run test:integration`,
  and `npm run test:e2e` each run only their own tier.

**Rationale**: Mirroring `src/` at the unit tier makes the test for any
file findable in O(1); grouping by feature/journey at the higher tiers
matches how those tests are actually reasoned about (behavior, not files).

#### 4. Naming Conventions

- **Test files**:
  - Unit and integration: `<ComponentName>.test.ts` where `<ComponentName>`
    is the exported subject (e.g. `passwordService.test.ts`,
    `sessionsRepo.test.ts`). Scenario-suffixed integration files use
    `<feature>.<scenario>.test.ts` (e.g. `auth.register.rateLimit.test.ts`).
  - E2E: `<user-journey-name>.spec.ts` in kebab-case
    (e.g. `register-and-login.spec.ts`, `password-reset.spec.ts`).
- **Test suites**: top-level `describe` MUST name the subject under test
  exactly: `describe('ComponentName', () => { ... })`. Nested `describe`
  blocks MAY name a method or scenario
  (`describe('passwordService', () => { describe('hash()', ...) })`).
- **Test cases**: `it` / `test` titles MUST follow the form
  `'should <do X> when <Y>'` (e.g.
  `it('should return 429 when the rate limit is exceeded', ...)`).
  Titles MUST describe externally observable behavior, never implementation
  detail.
- Title strings MUST NOT contain the words "correctly", "properly", or
  "works" — they add no information.

**Rationale**: A predictable naming scheme turns the test report itself
into living documentation: a reader can derive the spec of a module from
its suite titles alone.

#### 5. Test Anatomy

- The primary pattern is **Arrange–Act–Assert (AAA)**. Each test MUST
  visibly contain those three phases, separated by blank lines or comments
  when not otherwise obvious. Helper functions MAY be used for Arrange, but
  the Act and Assert phases MUST remain inside the test body.
- Setup that varies per test MUST use `beforeEach`. `beforeAll` is
  permitted **only** for genuinely immutable, expensive resources
  (e.g. opening a single Postgres pool, compiling a schema). Mutable state
  created in `beforeAll` is forbidden because it leaks across tests.
- `afterEach` MUST restore any global state mutated during the test
  (timers, mocks, environment variables, database rows).
- Each test MUST be **independently runnable**: invoking a single test via
  `jest -t '<title>'` MUST pass without running any other test first.
- **No shared global state**: tests MUST NOT rely on module-level mutable
  variables, ambient `process.env` changes from prior tests, or rows left
  behind by prior tests. Module mocks set via `jest.mock` MUST be reset
  with `jest.resetModules()` / `jest.restoreAllMocks()` in `afterEach`
  when mutated per test.
- Each test MUST have one logical assertion. Multiple `expect()` calls are
  permitted only when they collectively verify a single observable outcome.

**Rationale**: AAA + `beforeEach` + isolated state is what makes a test
suite **debuggable**: a single failure points at exactly one cause,
uncoupled from suite order or prior test history.

#### 6. Mocking & Test Data

The right test double for each dependency MUST be chosen deliberately:

- **Mock** (verify interactions) — use for external services with
  side effects we cannot reproduce in tests:
  - email/SMTP (`nodemailer`), payment providers, third-party HTTP APIs.
  - Implementation: `jest.mock('nodemailer')` / `jest.fn()` + assertions
    on `toHaveBeenCalledWith(...)`.
- **Stub** (return canned values) — use for time and other ambient
  sources of nondeterminism:
  - `Date.now()`, `setTimeout`, `setInterval`, `process.hrtime` MUST be
    stubbed via `jest.useFakeTimers()` or an injected `Clock`.
  - Cryptographic randomness used by tests MUST be stubbed via an
    injected RNG; production code MAY still use `crypto.randomBytes`.
- **Fake** (working in-memory implementation) — use at the unit tier
  for the database and other infrastructure that has a small enough
  surface to reimplement:
  - Repositories (e.g. `usersRepo`, `sessionsRepo`) MUST have in-memory
    `Map`-backed fakes for unit tests of services that depend on them.
  - Fakes MUST live under `tests/**/helpers/` and implement the same
    interface as the real repository (compile-time enforced).
- **Test fixtures**: complex sample data (valid/invalid registration
  payloads, JWT tokens, OpenAPI examples) MUST live under
  `tests/fixtures/` as plain `.ts` modules exporting typed constants.
  Fixtures MUST NOT be mutated by tests; clone before modifying.
- **Helpers**: repeated setup MUST be extracted into named factory
  helpers (e.g. `createTestUser(overrides?)`, `setupMockAPI()`,
  `buildAuthenticatedAgent()`). Helpers MUST accept overrides so a test
  can vary only the fields it cares about.

**Do NOT mock**:

- Code you own that is pure and cheap (validators, formatters, simple
  utilities, `zod` schemas) — use the real implementation.
- Trivial value objects or DTOs.
- The system under test itself, directly or transitively.
- Internal collaborators just to assert call shape; assert on the
  observable outcome instead (see §7).

**Rationale**: Choosing the cheapest faithful double keeps tests fast
without sacrificing fidelity; over-mocking owned code couples tests to
implementation and produces brittle suites that block refactoring.

#### 7. Quality Criteria (CRITICAL)

This subsection defines what makes a test acceptable. Reviewers MUST
reject any test that violates the criteria below; CI tooling MUST enforce
the quality gates.

**What makes a good test**:

- **Behavior, not implementation**: a test MUST assert on inputs and
  observable outputs (return values, HTTP responses, persisted state,
  emitted events) — never on private methods, internal field names, or
  the specific sequence of internal calls.
- **Meaningful assertions**: every test MUST contain at least one
  assertion whose expected value (the "oracle") was decided by a human
  from the specification, not copied from a debugger run.
  Tautological assertions are forbidden, including but not limited to:
  - `expect(x).toBe(x)` / `expect(x).toEqual(x)`,
  - asserting a value equals the result of the same function under test,
  - asserting only `toBeTruthy()` / `toBeDefined()` on a non-boolean
    return (use a specific value or shape).
- **Single responsibility**: a test exercises one behavior. If the test
  name needs the word "and", split it.
- **Fast**:
  - Individual unit test < **1 s** wall-clock.
  - Individual integration test < **5 s** wall-clock.
  - Tests exceeding the budget MUST be optimized, moved to a slower
    tier, or split.
- **Deterministic**: see §8. A test that fails for any reason other
  than a real defect is a bug to be fixed, not retried.

**Quality gates** (enforced in CI, per §12):

- **Mutation score ≥ 75%** via **Stryker Mutator**
  (`@stryker-mutator/core` + `@stryker-mutator/jest-runner`).
  Surviving mutants in the report MUST be triaged within one sprint.
- **No always-true / tautological assertions**: enforced by
  `eslint-plugin-jest` rules `no-identical-title`,
  `valid-expect`, `no-conditional-expect`, `expect-expect`, and
  `no-standalone-expect`. PRs MUST be rejected on lint violation.
- **Human-validated oracles**: every new test's expected value MUST be
  traceable in the PR description or commit message to a line in the
  spec (`spec.md`, `contracts/*.openapi.yaml`, or acceptance criteria).
  Reviewers MUST verify this trace.
- **Coverage**: lines ≥ 80%, branches ≥ 75% (see §2).

**Anti-patterns to avoid** (each is a rejectable defect):

- Testing private methods, module-internal helpers, or class internals
  by exporting them solely for tests.
- Interdependent tests — test A depends on test B running first.
- Brittle tests that fail on pure refactoring (e.g. asserting on the
  exact number of internal calls when the spec is indifferent).
- Flaky tests — see §8 and §12 quarantine policy.
- Tests without assertions (a test that only calls the SUT and never
  `expect`s anything is forbidden; `expect-expect` lint rule enforces).
- Copy-pasted test logic across files — extract into
  `tests/**/helpers/` once a third occurrence appears (the same rule
  of three from Principle I applies to test code).
- Snapshot tests used as the sole assertion for complex objects without
  human review of the snapshot diff.
- `console.log` / `console.error` left in committed tests.

**Rationale**: Coverage and a green build are necessary but not
sufficient. Mutation testing measures whether assertions actually _catch_
bugs; the anti-pattern list captures the failure modes that make a
green suite a false safety signal.

#### 8. Test Isolation & Determinism

- Tests MUST be independently runnable in any order. Reliance on cross-test
  state is forbidden.
- Time-dependent code MUST use fake timers (`jest.useFakeTimers()`) or an
  injected clock. Calls to `Date.now()`, `setTimeout`, and `setInterval`
  in production code paths MUST be testable via dependency injection.
- Randomness MUST be seeded or injected; tests MUST NOT depend on
  `Math.random()` output.
- Tests MUST NOT make outbound network calls. Outbound HTTP, SMTP
  (`nodemailer`), and third-party APIs MUST be replaced with mocks, fakes,
  or in-process servers at the unit and integration tiers.
- Flaky tests MUST be quarantined within one business day (see Section 12);
  silently retrying flaky tests in CI is forbidden.
- Each integration test MUST clean up its own data (transactional rollback
  or explicit teardown) so the suite is order-independent.

**Rationale**: Determinism is the prerequisite for trusting a red build.
Without it, the suite becomes noise and the safety net collapses.

#### 9. Database & External Dependencies

- **Unit tier**: repositories and external clients MUST be replaced by
  in-memory fakes or `jest.fn()` doubles. Unit tests MUST NOT open a real
  database, socket, or file handle.
- **Integration tier**: tests MUST exercise a **real PostgreSQL** instance
  using either:
  - a dedicated, disposable test database created per CI job, **or**
  - `testcontainers` to provision an ephemeral Postgres container.
- All SQL migrations under `src/db/migrations/` MUST be applied to the test
  database before the integration suite runs (`npm run db:migrate`).
- Connection strings, JWT secrets, bcrypt rounds, SMTP credentials, and any
  other configuration MUST be supplied via environment variables loaded
  through `src/config/env.ts`. Tests MUST NOT use production credentials
  or hit production-like endpoints; CI MUST inject test-only values.
- Each integration test MUST run inside a transaction that is rolled back
  on teardown, or explicitly truncate the tables it touched.

**Rationale**: Real Postgres at the integration tier catches bugs that
mocks hide (constraints, types, indexes); strict isolation at the unit
tier keeps the bulk of the suite fast.

#### 10. API Contract Testing

- The OpenAPI document at `specs/<feature>/contracts/*.openapi.yaml`
  (currently `auth-api.openapi.yaml`) is the **single source of truth**
  for HTTP contracts. Routes, request bodies, response bodies, and error
  shapes MUST conform to it.
- Every endpoint defined in the contract MUST have at least one integration
  test using `supertest` that asserts:
  - the documented HTTP status codes (success and each documented error),
  - the documented response body shape (validated against the contract
    or the corresponding `zod` schema),
  - the documented headers (e.g. `Set-Cookie`, `Content-Type`,
    `Retry-After`).
- Request validation MUST be performed by `zod` schemas in
  `src/routes/schemas/`. Each schema MUST have unit tests for both
  accepted and rejected inputs covering every documented constraint.
- Backward-incompatible contract changes MUST be accompanied by an updated
  OpenAPI file **and** updated tests in the same PR.

**Rationale**: A contract that drifts from its tests stops being a contract.
Tying tests to the OpenAPI spec keeps clients, server, and documentation in
lockstep.

#### 11. Security & Auth Testing

Because this repository ships an authentication system, the following test
categories are MANDATORY for any change touching auth, sessions, tokens,
password handling, or rate limiting:

- **Password handling**: `bcrypt` cost factor MUST be asserted; tests MUST
  verify that plaintext passwords are never logged, returned in responses,
  or stored. A negative test MUST fail the build if a password column is
  serialized.
- **Token handling**: `jsonwebtoken` issuance and verification MUST be
  tested for: correct signing algorithm (no `alg: none`), correct
  expiration enforcement (expired tokens rejected), tampered-signature
  rejection, and audience/issuer claims when applicable.
- **Session lifecycle**: register → login → access → logout flows MUST
  have integration tests, including session expiry and revocation.
- **Authorization**: every protected route MUST have at least one negative
  test for **unauthenticated** access and one for **insufficient
  privilege** where roles apply.
- **Rate limiting**: routes guarded by `express-rate-limit` MUST have an
  integration test that exceeds the limit and asserts HTTP 429 plus the
  `Retry-After` header.
- **Input handling**: SQL injection, oversized payloads, and malformed
  JSON MUST be covered by validation tests at the route boundary.
- Security tests MUST NOT be skipped or marked `.skip`/`.todo` in
  committed code without an open, linked tracking issue.

**Rationale**: Auth defects are high-severity and externally exploitable;
they cannot be left to manual review.

#### 12. CI Quality Gates & Flake Policy

- A merge to the default branch is blocked unless **all** of the following
  pass in CI, in this order, with non-zero exits failing the pipeline:
  1. `npm run typecheck` (TypeScript strict, no errors)
  2. `npm run lint` (ESLint, zero errors, zero warnings)
  3. `npm run format:check` (Prettier)
  4. `npm run test:unit`
  5. `npm run test:integration`
  6. `npm run test:e2e` (when applicable to the change)
  7. Coverage thresholds from Section 2 (lines ≥ 80%, branches ≥ 75%)
  8. Mutation score ≥ 75% via Stryker (MAY run nightly if PR-time runtime
     exceeds the suite's performance budget; nightly failures still block
     the next merge)
- **Performance budget**: the unit suite MUST complete in **≤ 60 s** and
  the integration suite in **≤ 5 min** on the default CI runner.
  Regressions exceeding the budget by 20% MUST be addressed before merge.
- **Flake policy**: a test that fails intermittently MUST be quarantined
  within **one business day** by moving it into a `quarantine/` describe
  block (or equivalent `testPathIgnorePatterns` entry) with a linked
  tracking issue. Quarantined tests MUST be fixed or deleted within
  **two weeks**; older quarantine entries fail CI.
- CI MUST NOT use `jest --retry` or any equivalent rerun-until-green
  mechanism. Flakes are bugs, not noise.
- Coverage and mutation reports MUST be uploaded as PR artifacts so
  reviewers can inspect trends.

**Rationale**: Gates that are not enforced are aspirations; a flake
policy with a deadline is the only thing that keeps a green build
meaningful over time.

#### 13. Tools & Frameworks

The testing toolchain is fixed at the versions and roles below. Swapping a
tool listed here requires a constitution amendment.

**Package manager**: `npm` (lockfile: `package-lock.json`). All commands
in this section are run with `npm`.

**Static analysis**:

- **Type checker**: TypeScript `^5.4` in **strict** mode (all flags listed
  in Principle II). Invocation: `tsc -p tsconfig.json --noEmit`.
- **Linter**: ESLint `^8` with `@typescript-eslint` parser + plugin,
  `eslint-plugin-jsdoc`, `eslint-plugin-jest` (to enforce §7
  anti-tautology rules: `expect-expect`, `valid-expect`,
  `no-conditional-expect`, `no-standalone-expect`, `no-identical-title`,
  `no-disabled-tests`), and `eslint-config-prettier` to defer formatting
  to Prettier.
- **Formatter**: Prettier `^3` (`.prettierrc` at repo root).

**Unit & integration testing**:

- **Framework**: Jest `^29` with `ts-jest` `^29`, configured with the
  three-project split (`unit`, `integration`, `e2e`) defined in §3.
- **Assertions**: Jest's built-in `expect` (Jasmine-style matchers). Do
  NOT add Chai or other assertion libraries.
- **Mocking**: Jest's built-in `jest.fn()`, `jest.mock()`,
  `jest.spyOn()`, `jest.useFakeTimers()`. Do NOT add `sinon` or
  `testdouble`.
- **HTTP**: Supertest `^7` for in-process Express assertions at the
  integration tier.
- **Postgres**: a dedicated test database; `testcontainers` MAY be added
  if CI cannot provide one (§9).

**End-to-end testing**:

- **Framework**: **Playwright** `^1.45` (recommended) running against a
  locally-launched server. Test files: `tests/e2e/**/*.spec.ts`,
  configured in `playwright.config.ts`. If the team chooses to keep E2E
  on Jest + Supertest in the short term, the file glob in §3 still
  applies and the choice MUST be recorded as a TODO in the Sync Impact
  Report.
- **Optional**: **Stagehand** MAY be used on top of Playwright for
  AI-native browser automation when scripting a journey by hand is
  uneconomical. Stagehand-authored tests MUST still meet §7 Quality
  Criteria (deterministic, observable-behavior assertions, validated
  oracles); flaky AI-driven steps MUST be replaced with deterministic
  selectors before merge.

**Coverage & quality**:

- **Coverage tool**: Jest built-in coverage (Istanbul under the hood),
  via `jest --coverage`. Thresholds in `jest.config.ts`:
  `coverageThreshold.global = { lines: 80, branches: 75 }`.
- **Mutation testing**: **Stryker Mutator**
  (`@stryker-mutator/core` `^8` + `@stryker-mutator/jest-runner` `^8`).
  Config in `stryker.conf.mjs`; `thresholds.high = 80`,
  `thresholds.low = 75`, `thresholds.break = 75`.

**Execution commands** (npm scripts — every entry below MUST exist in
`package.json`):

| Purpose                | Command                          |
|------------------------|----------------------------------|
| Type check             | `npm run typecheck`              |
| Lint                   | `npm run lint`                   |
| Format check           | `npm run format:check`           |
| Run all tests          | `npm test`                       |
| Run unit tests         | `npm run test:unit`              |
| Run integration tests  | `npm run test:integration`       |
| Run E2E tests          | `npm run test:e2e`               |
| Generate coverage      | `npm test -- --coverage`         |
| Run mutation testing   | `npm run test:mutation`          |

The `test:mutation` script MUST invoke Stryker
(`stryker run`) and MUST exit non-zero when the mutation score falls
below 75.

**Pre-commit hook** (via `husky` + `lint-staged`, installed under
`.husky/pre-commit`): MUST run, in order, and abort the commit on the
first failure:

1. `npm run typecheck`
2. `npm run lint` (on staged files via `lint-staged` when possible,
   else whole project)
3. `npm run test:unit`

Integration, E2E, coverage, and mutation testing are intentionally
excluded from the pre-commit hook (they belong to CI) to keep the
local commit loop under ~30 seconds.

**CI/CD pipeline** (executed on every PR and on `main`):

- **Every PR**: typecheck → lint → format:check → test:unit →
  test:integration → test:e2e (when applicable) → coverage thresholds.
- **`main` branch (and release branches)**: all of the above **plus**
  `npm run test:mutation` enforcing mutation score ≥ 75. Mutation
  testing MAY also run nightly to keep PR runtime within the §12
  performance budget; nightly failures block the next merge to `main`.

**Rationale**: Naming the exact tools, versions, commands, and hook
scope makes the rest of Principle III mechanically enforceable rather
than aspirational, and prevents tool-drift (e.g. someone introducing
Vitest or Chai) from silently invalidating the gates.

### IV. JSDoc Documentation

All code MUST be documented with JSDoc comments.

- Every exported symbol (functions, classes, methods, types, interfaces,
  enums, constants) MUST have a JSDoc block with a one-line summary and, when
  non-trivial, a longer description.
- Function JSDoc MUST document each `@param` (semantic meaning beyond the
  type), `@returns`, and any `@throws` conditions.
- Public APIs MUST include at least one `@example` block demonstrating
  typical usage.
- Deprecations MUST use `@deprecated` with the replacement and removal target.
- Internal (non-exported) symbols SHOULD carry JSDoc when their intent is not
  obvious from the name; reviewers MUST request docs when intent is unclear.
- A documentation linter (`eslint-plugin-jsdoc`) MUST enforce the above
  rules in CI.

**Rationale**: JSDoc surfaces intent in editor tooltips and generated docs,
makes refactoring safer, and lowers the cost of future contributors—without
duplicating type information already enforced by TypeScript.

## Engineering Constraints

- **Language**: TypeScript is the default implementation language for all new
  modules. Introducing another language requires an entry in the plan's
  Complexity Tracking section with justification.
- **Tooling baseline**: ESLint (with `@typescript-eslint`,
  `eslint-plugin-jsdoc`), Prettier, Jest (with `ts-jest` and the
  unit/integration/e2e project split), Supertest, and Stryker Mutator MUST
  be configured at project root.
- **CI gates**: type-check, lint, format-check, unit + integration + e2e
  tests, coverage thresholds, and mutation score MUST all pass before merge
  (see Principle III §8).
- **Dependencies**: New runtime dependencies MUST be reviewed for license,
  maintenance status, and footprint; prefer the standard library or existing
  utilities first.

## Development Workflow & Quality Gates

- All changes land via pull request; direct pushes to the default branch are
  forbidden.
- Every PR MUST: pass CI gates above, include or update tests for changed
  business logic (with a visible RED commit or PR description note when
  practicing strict TDD), include or update JSDoc for changed public APIs,
  and link the spec/plan/task it implements.
- Reviewers MUST verify constitution compliance and explicitly call out any
  deviation. Deviations MUST be recorded in the plan's Complexity Tracking
  table with rationale and rejected alternatives.
- Coverage, mutation, and lint reports MUST be visible on the PR.
- Released versions MUST follow Semantic Versioning.

## Governance

This constitution supersedes ad-hoc practices and prior conventions. It
applies to all source, tests, and tooling in this repository.

**Amendment procedure**:

1. Propose the change in a PR that edits this file and includes a Sync Impact
   Report at the top.
2. Justify the version bump per the policy below.
3. Update any dependent templates and documentation in the same PR.
4. Require approval from at least one maintainer before merge.

**Versioning policy** (semantic):

- **MAJOR**: Removing or redefining a principle in a backward-incompatible
  way, or removing a governance rule.
- **MINOR**: Adding a new principle/section, or materially expanding an
  existing one.
- **PATCH**: Wording clarifications, typo fixes, or non-semantic refinements.

**Compliance review**: Maintainers MUST audit a sample of merged PRs each
release cycle for adherence to these principles. Repeated violations trigger
a tooling or workflow fix, not just a reminder.

**Version**: 2.3.0 | **Ratified**: 2026-05-08 | **Last Amended**: 2026-05-12
