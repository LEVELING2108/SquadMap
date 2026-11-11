CREATE TABLE users (
    id                uuid         PRIMARY KEY,
    email             varchar(254) NOT NULL,
    password_hash     varchar(255) NOT NULL,
    name              varchar(60)  NOT NULL,
    color             varchar(7)   NOT NULL,
    settings          jsonb        NOT NULL DEFAULT '{}'::jsonb,
    terms_version     varchar(20)  NOT NULL,
    terms_accepted_at timestamptz  NOT NULL,
    created_at        timestamptz  NOT NULL,
    updated_at        timestamptz  NOT NULL,
    -- Set when the person asks to delete the account; the row is removed after the grace period.
    deleted_at        timestamptz,

    -- Emails are stored lower-case so the unique index below is case-insensitive.
    CONSTRAINT users_email_lowercase CHECK (email = lower(email))
);

CREATE UNIQUE INDEX users_email_key ON users (email);
