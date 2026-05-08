# Phase 1 Data Model: User Authentication System

Three tables in a single PostgreSQL schema (`public`). All timestamps are `TIMESTAMPTZ` stored in UTC. All primary keys are UUID v4 generated application-side (`gen_random_uuid()` is also acceptable; pick one and stick to it in migrations).

## Entity: `users`

Represents a person able to authenticate. Maps to spec entity **User Account**.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK, NOT NULL | Stable internal identifier; never exposed in URLs that the user can edit. |
| `email_normalized` | `TEXT` | NOT NULL, UNIQUE | Lowercased and whitespace-trimmed form used for lookup (FR-002). |
| `email_display` | `TEXT` | NOT NULL | Original casing as supplied by the user; for display in emails only. |
| `password_hash` | `TEXT` | NOT NULL | bcrypt hash; format includes cost and salt (FR-005). |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()` | |
| `last_login_at` | `TIMESTAMPTZ` | NULL | Updated on every successful login. |

**Indexes**: `UNIQUE (email_normalized)`.

**Validation rules** (enforced in `services/registrationService` + `validate` middleware):

- `email_normalized` MUST match RFC-5321-ish syntax via `zod.string().email()` after `.trim().toLowerCase()`.
- `password_hash` MUST be the result of `bcrypt.hash(plain, BCRYPT_COST)`; plaintext MUST never be persisted (FR-005).

**State**: A row is created exactly once at registration; never deleted by this feature. Account deletion is explicitly out of scope (spec Assumptions).

---

## Entity: `sessions`

Represents one authenticated session for one user on one client. Maps to spec entity **Authenticated Session**.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `jti` | `UUID` | PK, NOT NULL | Carried as the `jti` claim of the JWT. |
| `user_id` | `UUID` | NOT NULL, FK → `users.id` ON DELETE CASCADE | |
| `issued_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()` | |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | Always `issued_at + INTERVAL '24 hours'` (FR-008). |
| `revoked_at` | `TIMESTAMPTZ` | NULL | Set on logout (FR-009) or by password change (FR-015). |
| `revoked_reason` | `TEXT` | NULL, CHECK in (`'logout'`, `'password_change'`, `'admin'`) | For audit. |

**Indexes**:

- `INDEX (user_id, expires_at)` — supports "revoke all active sessions for this user".
- Partial `INDEX (jti) WHERE revoked_at IS NULL` is implicit via the PK.

**State transitions**:

```
[active]  -- explicit logout    --> [revoked: logout]
[active]  -- password change    --> [revoked: password_change]
[active]  -- now() > expires_at --> [expired]    (no row update; middleware checks expiry)
```

A session is "valid" iff: row exists, `revoked_at IS NULL`, AND `expires_at > now()`. The auth middleware checks all three (FR-008, FR-009, FR-015).

**Cleanup**: A periodic job (out of scope for v1, documented in quickstart) MAY delete rows where `expires_at < now() - INTERVAL '30 days'`.

---

## Entity: `password_reset_requests`

Represents an in-flight reset attempt. Maps to spec entity **Password Reset Request**.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK, NOT NULL | Internal id; not in the link. |
| `user_id` | `UUID` | NOT NULL, FK → `users.id` ON DELETE CASCADE | |
| `token_hash` | `BYTEA` | NOT NULL, UNIQUE | SHA-256 of the raw token; raw token is never stored (FR-005 spirit + FR-017). |
| `issued_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()` | |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | Always `issued_at + INTERVAL '1 hour'` (FR-012). |
| `consumed_at` | `TIMESTAMPTZ` | NULL | Set on successful reset (FR-012, single-use). |
| `superseded_at` | `TIMESTAMPTZ` | NULL | Set when a newer request is issued for the same user (FR-013). |

**Indexes**:

- `UNIQUE (token_hash)`.
- `INDEX (user_id) WHERE consumed_at IS NULL AND superseded_at IS NULL` — supports the "supersede previous unused links" update.

**State transitions**:

```
[unused]  -- new request for same user --> [superseded]
[unused]  -- successful reset          --> [consumed]
[unused]  -- now() > expires_at        --> [expired]   (no row update; verify checks expiry)
```

A reset token is "redeemable" iff: hash matches a row, `consumed_at IS NULL`, `superseded_at IS NULL`, AND `expires_at > now()`. Redemption MUST be transactional: in a single SQL transaction, set `consumed_at = now()`, update `users.password_hash`, and revoke all sessions for that `user_id` with `revoked_reason = 'password_change'` (FR-014, FR-015).

---

## Cross-cutting rules

- **Email normalization**: `users.email_normalized = lower(trim(input))`. The unique constraint enforces FR-004 at the database level even under a race.
- **No PII in JWT**: only `sub` (user id), `jti`, `iat`, `exp` are claimed. Email is not in the token.
- **No secrets in logs**: `password_hash`, raw reset tokens, and JWTs MUST be in the `pino` redaction list (FR-017).
- **Time source**: All "now" comparisons use the database `now()` for state changes and `Date.now()` only inside JWT signing/verification, which uses seconds-since-epoch.
