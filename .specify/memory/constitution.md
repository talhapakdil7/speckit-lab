<!--
SYNC IMPACT REPORT
==================
Version change: [none] → 1.0.0 (initial ratification)
Bump rationale: First concrete constitution; all four principles newly defined
  and governance section established. MAJOR bump because this replaces the
  template placeholders with binding, non-negotiable rules.

Modified principles:
  - [PRINCIPLE_1_NAME] → I. Clean Code
  - [PRINCIPLE_2_NAME] → II. TypeScript Strict Mode
  - [PRINCIPLE_3_NAME] → III. Testing Pyramid (NON-NEGOTIABLE)
  - [PRINCIPLE_4_NAME] → IV. JSDoc Documentation
  - [PRINCIPLE_5_NAME] → REMOVED (project requested four principles)

Added sections:
  - Engineering Constraints
  - Development Workflow & Quality Gates
  - Governance

Removed sections:
  - Placeholder fifth principle slot

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check gate is generic;
    principles will be evaluated per-feature — no edit required)
  - ✅ .specify/templates/spec-template.md (no principle-specific sections; OK)
  - ✅ .specify/templates/tasks-template.md (existing phases accommodate
    test/lint/docs task categories — no edit required)
  - ✅ .github/copilot-instructions.md (defers to current plan; OK)

Follow-up TODOs:
  - TODO(RATIFICATION_DATE): Confirm whether 2026-05-08 is the official
    adoption date or if an earlier internal adoption date should be used.
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

### III. Testing Pyramid (NON-NEGOTIABLE)

Tests MUST follow the testing pyramid: many fast unit tests, fewer integration
tests, and a small number of end-to-end tests.

- **Unit tests**: Cover pure functions, services, and domain logic in
  isolation; no network, no filesystem, no real database.
- **Integration tests**: Cover module boundaries, persistence, and contracts
  between services using realistic but contained dependencies.
- **End-to-end tests**: Cover the highest-value user journeys only.
- **Coverage**: Code identified as **business logic** (domain models,
  services, use-cases, calculation/validation modules) MUST maintain
  **≥ 80% line and branch coverage**. Coverage MUST be measured in CI and the
  build MUST fail below threshold. Infrastructure glue, generated code, and
  trivial DTOs are excluded from the threshold but MUST be tagged as such in
  the coverage configuration.
- New business logic MUST ship with tests in the same change set; PRs that
  reduce coverage of touched business-logic files below 80% MUST be rejected.

**Rationale**: The pyramid keeps the suite fast and stable; the 80% floor on
business logic targets coverage where defects are most costly while avoiding
false confidence from chasing 100%.

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
- A documentation linter (e.g. `eslint-plugin-jsdoc`) MUST enforce the above
  rules in CI.

**Rationale**: JSDoc surfaces intent in editor tooltips and generated docs,
makes refactoring safer, and lowers the cost of future contributors—without
duplicating type information already enforced by TypeScript.

## Engineering Constraints

- **Language**: TypeScript is the default implementation language for all new
  modules. Introducing another language requires an entry in the plan's
  Complexity Tracking section with justification.
- **Tooling baseline**: ESLint (with `@typescript-eslint`,
  `eslint-plugin-jsdoc`), Prettier, and a coverage-capable test runner
  (e.g. Vitest or Jest) MUST be configured at project root.
- **CI gates**: type-check, lint, format-check, unit + integration tests, and
  coverage threshold MUST all pass before merge.
- **Dependencies**: New runtime dependencies MUST be reviewed for license,
  maintenance status, and footprint; prefer the standard library or existing
  utilities first.

## Development Workflow & Quality Gates

- All changes land via pull request; direct pushes to the default branch are
  forbidden.
- Every PR MUST: pass CI gates above, include or update tests for changed
  business logic, include or update JSDoc for changed public APIs, and link
  the spec/plan/task it implements.
- Reviewers MUST verify constitution compliance and explicitly call out any
  deviation. Deviations MUST be recorded in the plan's Complexity Tracking
  table with rationale and rejected alternatives.
- Coverage and lint reports MUST be visible on the PR.
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

**Version**: 1.0.0 | **Ratified**: 2026-05-08 | **Last Amended**: 2026-05-08
