-- How far each person moved while sharing, in metres, saved when the trip ends or they leave. Only this
-- total is kept: never the points it was added up from.
ALTER TABLE trip_members ADD COLUMN distance_m integer;
ALTER TABLE trip_members ADD CONSTRAINT trip_members_distance_not_negative CHECK (distance_m >= 0);
