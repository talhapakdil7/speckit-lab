-- Up Migration
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash BYTEA NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  superseded_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_reset_active_per_user
  ON password_reset_requests (user_id)
  WHERE consumed_at IS NULL AND superseded_at IS NULL;

-- Down Migration
-- DROP TABLE IF EXISTS password_reset_requests;
