-- One row per refresh token. A sign-in starts a family; every refresh adds the next token to it.
-- Only a SHA-256 hash of the token is stored, so a database leak does not hand out sessions.
CREATE TABLE refresh_tokens (
    id          uuid        PRIMARY KEY,
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    family_id   uuid        NOT NULL,
    token_hash  varchar(64) NOT NULL,
    created_at  timestamptz NOT NULL,
    expires_at  timestamptz NOT NULL,
    -- Set when the token is exchanged for the next one. Presenting it again means it was copied.
    used_at     timestamptz,
    -- Set when the session ends: log out, or reuse detected anywhere in the family.
    revoked_at  timestamptz
);

CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON refresh_tokens (token_hash);
CREATE INDEX refresh_tokens_family_id_idx ON refresh_tokens (family_id);
CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_expires_at_idx ON refresh_tokens (expires_at);
