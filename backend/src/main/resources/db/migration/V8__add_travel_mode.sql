-- How a member says they are getting to the destination: 'car', 'bike' or 'walk'. Empty until they choose;
-- the app then guesses from the distance. Used to ask for the right kind of route and ETA.
ALTER TABLE trip_members
    ADD COLUMN travel_mode varchar(10),
    ADD CONSTRAINT trip_members_travel_mode_check CHECK (travel_mode IN ('car', 'bike', 'walk'));
