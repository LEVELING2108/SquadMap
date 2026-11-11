-- Baseline: establishes the migration history. Tables arrive with the features that own them.
-- Applied migrations are never edited; every schema change is a new V{n}__description.sql file.
SELECT 1;
