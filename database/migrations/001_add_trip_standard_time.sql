-- Add persisted trip standard duration for aggregate goal calculations.
ALTER TABLE `trips`
    ADD COLUMN `standard_time_ms` BIGINT UNSIGNED NULL AFTER `end_time`;

UPDATE `trips`
SET `standard_time_ms` = GREATEST(
    1,
    TIMESTAMPDIFF(MICROSECOND, `start_time`, `end_time`) DIV 1000
)
WHERE `standard_time_ms` IS NULL;

ALTER TABLE `trips`
    MODIFY COLUMN `standard_time_ms` BIGINT UNSIGNED NOT NULL,
    ADD CONSTRAINT `chk_trips_standard_time` CHECK (`standard_time_ms` > 0),
    ADD KEY `idx_trips_user_start` (`user_id`, `start_time`);
