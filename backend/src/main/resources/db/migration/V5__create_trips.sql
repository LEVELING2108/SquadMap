-- A trip: a host shares a link, members see each other until it expires or the host ends it.
CREATE TABLE trips (
    id            uuid             PRIMARY KEY,
    host_id       uuid             NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name          varchar(60)      NOT NULL,
    -- 8 characters from a 31-letter alphabet with no look-alikes (no 0 O 1 I L).
    code          varchar(8)       NOT NULL,
    dest_name     varchar(120),
    dest_lat      double precision,
    dest_lng      double precision,
    chat_enabled  boolean          NOT NULL,
    starts_at     timestamptz      NOT NULL,
    expires_at    timestamptz      NOT NULL,
    ended_at      timestamptz,
    status        varchar(10)      NOT NULL,
    created_at    timestamptz      NOT NULL,

    CONSTRAINT trips_status_known CHECK (status IN ('active', 'ended', 'expired')),
    CONSTRAINT trips_code_format CHECK (code ~ '^[2-9A-HJKMNP-Z]{8}$'),
    CONSTRAINT trips_destination_complete CHECK (
        (dest_name IS NULL AND dest_lat IS NULL AND dest_lng IS NULL)
        OR (dest_name IS NOT NULL AND dest_lat BETWEEN -90 AND 90 AND dest_lng BETWEEN -180 AND 180)),
    CONSTRAINT trips_expires_after_start CHECK (expires_at > starts_at)
);

CREATE UNIQUE INDEX trips_code_key ON trips (code);
CREATE INDEX trips_status_expires_at_idx ON trips (status, expires_at);
CREATE INDEX trips_host_id_idx ON trips (host_id);

-- One row per person per trip. Guests have no account, so user_id is empty for them.
CREATE TABLE trip_members (
    id            uuid         PRIMARY KEY,
    trip_id       uuid         NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    user_id       uuid         REFERENCES users (id) ON DELETE SET NULL,
    display_name  varchar(40)  NOT NULL,
    color         varchar(7)   NOT NULL,
    role          varchar(10)  NOT NULL,
    joined_at     timestamptz  NOT NULL,
    left_at       timestamptz,
    arrived_at    timestamptz,
    paused        boolean      NOT NULL DEFAULT false,

    CONSTRAINT trip_members_role_known CHECK (role IN ('host', 'member'))
);

CREATE INDEX trip_members_trip_id_idx ON trip_members (trip_id);
CREATE INDEX trip_members_user_id_idx ON trip_members (user_id);
-- An account is on a trip at most once at a time.
CREATE UNIQUE INDEX trip_members_one_active_per_user
    ON trip_members (trip_id, user_id) WHERE user_id IS NOT NULL AND left_at IS NULL;
