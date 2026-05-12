-- Up Migration
CREATE TABLE IF NOT EXISTS sessions (
  jti UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  revoked_reason TEXT NULL CHECK (revoked_reason IN ('logout','password_change','admin'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_expires
  ON sessions (user_id, expires_at);

-- Down Migration
-- DROP TABLE IF EXISTS sessions;
