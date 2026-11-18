-- Sign-in sessions. The app keeps the raw token (only when "Keep me signed in"
-- is ticked); the database stores its SHA-256 hash. Ended sessions are kept
-- (revoked_at set) so Settings can show recent sign-ins.
CREATE TABLE sessions (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash    TEXT NOT NULL UNIQUE,
    device        TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL,
    revoked_at    TIMESTAMPTZ
);
CREATE INDEX sessions_user_idx ON sessions (user_id, created_at DESC);

-- Shown in Settings › Privacy & Security.
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMPTZ;
