-- The in-app inbox. Names and colours are copied in as they were when the alert was made, like a
-- trip member's name, and every alert is deleted after 30 days.
CREATE TABLE alerts (
    id           uuid         PRIMARY KEY,
    user_id      uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind         varchar(20)  NOT NULL,
    trip_id      uuid         NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    trip_name    varchar(60)  NOT NULL,
    -- The friend the alert is about, for joined and left.
    actor_name   varchar(60),
    actor_color  varchar(7),
    created_at   timestamptz  NOT NULL,
    read_at      timestamptz,

    CONSTRAINT alerts_kind_known CHECK (kind IN ('member_joined', 'member_left', 'ending_soon', 'trip_ended'))
);

CREATE INDEX alerts_user_created_idx ON alerts (user_id, created_at DESC, id DESC);
CREATE INDEX alerts_user_unread_idx ON alerts (user_id) WHERE read_at IS NULL;
CREATE INDEX alerts_created_idx ON alerts (created_at);

-- The trip end time the host was last warned about. A different value (after an extension) means a
-- new warning is due.
ALTER TABLE trips ADD COLUMN ending_soon_alerted_for timestamptz;
