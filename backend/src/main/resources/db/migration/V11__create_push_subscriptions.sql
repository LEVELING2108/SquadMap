-- Phones and browsers that asked for push notifications. The endpoint is a secret address at the
-- browser's push service: whoever holds it (with the keys) can send to that device, so it is never logged.
CREATE TABLE push_subscriptions (
    id            uuid          PRIMARY KEY,
    user_id       uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    endpoint      varchar(1024) NOT NULL,
    -- The browser's public key and auth secret, base64url, used to encrypt each message to it.
    p256dh        varchar(100)  NOT NULL,
    auth          varchar(40)   NOT NULL,
    created_at    timestamptz   NOT NULL,

    CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint)
);

CREATE INDEX push_subscriptions_user_idx ON push_subscriptions (user_id, created_at);
