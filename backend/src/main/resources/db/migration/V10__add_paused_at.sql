-- When a member paused sharing their location on the trip, or empty while they share (or never did).
-- Pausing keeps their consent: it is a hold they lift themselves, not a withdrawal. Their last spot stays in
-- Redis until they resume, leave or the trip ends; nothing about it is stored here.
ALTER TABLE trip_members ADD COLUMN paused_at timestamptz;
