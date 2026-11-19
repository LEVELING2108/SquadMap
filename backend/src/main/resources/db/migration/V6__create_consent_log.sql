-- Proof of consent to share location on a trip: who agreed, to which policy version, and when.
-- A row exists only when someone chose to share; choosing "Not now" records nothing.
CREATE TABLE consent_log (
    id              uuid         PRIMARY KEY,
    trip_member_id  uuid         NOT NULL REFERENCES trip_members (id) ON DELETE CASCADE,
    policy_version  varchar(20)  NOT NULL,
    granted_at      timestamptz  NOT NULL,
    -- Set when the person stops sharing (pause, leave or account deletion).
    withdrawn_at    timestamptz
);

CREATE INDEX consent_log_trip_member_id_idx ON consent_log (trip_member_id);
