# Quickstart: User Authentication System

This guide gets a developer from a fresh clone to a green test run and a manual end-to-end smoke test of the auth API.

## Prerequisites

- Node.js 20 LTS and npm 10+
- Docker (for the local PostgreSQL container) **or** a reachable PostgreSQL 16 instance
- A POSIX shell (macOS / Linux / WSL)

## 1. Install and configure

```bash
npm install
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
DATABASE_URL=postgres://auth:auth@localhost:5432/auth
JWT_SECRET=<32+ random bytes, base64 or hex>
BCRYPT_COST=12
PUBLIC_URL=http://localhost:3000
SMTP_URL=memory://    # use the in-memory transport for local dev
PORT=3000
```

> `JWT_SECRET` MUST be at least 32 bytes of entropy. Generate one with
> `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

## 2. Start PostgreSQL

```bash
docker run --rm -d --name auth-pg \
  -e POSTGRES_USER=auth -e POSTGRES_PASSWORD=auth -e POSTGRES_DB=auth \
  -p 5432:5432 postgres:16
```

## 3. Run migrations

```bash
npm run db:migrate
```

## 4. Run the test suite

```bash
npm test            # unit + integration + e2e, with coverage
npm run test:unit   # unit only, fast loop
```

The build fails if coverage on `src/services/**`, `src/db/repositories/**`, or `src/middleware/**` drops below 80% lines or branches (constitution principle III).

## 5. Start the service

```bash
npm run dev         # ts-node-dev, hot reload
# or
npm run build && npm start
```

The service listens on `http://localhost:3000`.

## 6. Manual smoke test (the happy path)

```bash
# Register
curl -sS -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"correcthorse9"}'

# → 201 { token, expiresAt, user }
# Save the token:
TOKEN=<paste token from response>

# Call a protected endpoint
curl -sS http://localhost:3000/auth/me \
  -H "Authorization: Bearer $TOKEN"
# → 200 { id, email: "alice@example.com" }

# Log out
curl -sS -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $TOKEN" -i
# → 204; the same TOKEN now returns 401 on /auth/me

# Forgot password
curl -sS -X POST http://localhost:3000/auth/password-reset/request \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com"}'
# → 202 (always, even for unknown emails)

# In dev with SMTP_URL=memory://, captured emails are written to ./tmp/emails/.
# Open the latest file, copy the token from the reset URL, then:
RESET_TOKEN=<paste token from email>

curl -sS -X POST http://localhost:3000/auth/password-reset/confirm \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$RESET_TOKEN\",\"newPassword\":\"newcorrecthorse9\"}" -i
# → 204; old password no longer works, new password does.
```

## 7. Verifying the spec's success criteria locally

| Criterion | How to verify |
|-----------|---------------|
| SC-001 / SC-002 (latency) | `npm run bench:auth` (artillery script under `tests/perf/`) — out of scope for v1, stub provided. |
| SC-005 (no session > 24h) | Integration test `auth.login.test.ts › rejects an expired session` mocks the clock and asserts a 401. |
| FR-009 / FR-015 (immediate logout / password-change invalidation) | `auth.logout.test.ts` and `auth.passwordReset.test.ts` cover both. |
| FR-017 (no secrets in logs) | `unit/logger.test.ts` asserts `password`, `newPassword`, `token`, and `Authorization` are redacted by the `pino` config. |

## 8. Troubleshooting

- **`ECONNREFUSED` on startup**: Postgres container isn't running. Re-run step 2.
- **Tests hang in CI**: ensure the test Postgres service is healthy before `npm test` runs; `tests/integration/helpers/testDb.ts` waits up to 30 s.
- **`429 rate_limited` during local poking**: lower the limits in `src/middleware/rateLimit.ts` for dev, or restart the process to clear the in-memory counters.
