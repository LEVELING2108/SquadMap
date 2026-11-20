-- When a deleted account's personal data was removed, 30 days after the person asked. The row stays as an
-- anonymous shell, so trips that friends still have in their history keep a host; nothing in it points to
-- the person any more.
ALTER TABLE users ADD COLUMN purged_at timestamptz;

CREATE INDEX users_pending_deletion_idx ON users (deleted_at) WHERE deleted_at IS NOT NULL AND purged_at IS NULL;
