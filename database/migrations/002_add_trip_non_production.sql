-- Add trip-level non-production classification for filtered history and goal calculations.
ALTER TABLE `trips`
    ADD COLUMN `non_production` TINYINT(1) NOT NULL DEFAULT 0 AFTER `standard_time_ms`,
    ADD CONSTRAINT `chk_trips_non_production` CHECK (`non_production` IN (0, 1));
