-- todly PHASE 2 — password reset tokens
-- Stores only a SHA-256 hash of the opaque reset token (never the raw token).

CREATE TABLE password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id);
CREATE UNIQUE INDEX idx_password_reset_token_hash ON password_reset_tokens(token_hash);
