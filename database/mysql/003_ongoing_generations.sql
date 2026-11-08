-- Prepared schema only; the MySQL adapter is not yet connected.
ALTER TABLE generations ADD COLUMN ongoing BOOLEAN NOT NULL DEFAULT FALSE;
INSERT INTO schema_migrations(version) VALUES ('003_ongoing_generations');
-- The server resolves ongoing ranges to the current Istanbul year and materializes
-- model-year rows at save/publish. Product compatibility year ranges stay explicit.
