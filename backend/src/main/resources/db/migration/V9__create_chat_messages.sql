-- Trip chat. Messages are deleted 7 days after the trip ends. The sender's name and colour come from
-- trip_members, which keeps people who left, so their messages still show who wrote them.
CREATE TABLE chat_messages (
    id          uuid          PRIMARY KEY,
    trip_id     uuid          NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    member_id   uuid          NOT NULL REFERENCES trip_members (id) ON DELETE CASCADE,
    -- Chosen by the sender's app, so a retried send gives back the first message instead of a second one.
    client_id   uuid,
    body        varchar(280)  NOT NULL,
    created_at  timestamptz   NOT NULL,

    CONSTRAINT chat_messages_body_not_blank CHECK (length(btrim(body)) > 0)
);

-- Ids are time-ordered (UUID v7), so newest first is id order.
CREATE INDEX chat_messages_trip_id_idx ON chat_messages (trip_id, id DESC);
CREATE UNIQUE INDEX chat_messages_client_id_idx ON chat_messages (member_id, client_id) WHERE client_id IS NOT NULL;

-- The newest message the member has seen; anything newer from someone else counts as unread.
ALTER TABLE trip_members ADD COLUMN chat_read_upto uuid;
