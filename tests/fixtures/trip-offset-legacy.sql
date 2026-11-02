CREATE TABLE IF NOT EXISTS `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `first_name` VARCHAR(100) NOT NULL,
    `middle_name` VARCHAR(100) NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `preferred_name` VARCHAR(100) NULL,
    `username` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `permissions` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `trips` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NOT NULL,
    `standard_time_ms` BIGINT UNSIGNED NULL,
    `counted_time_ms` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `non_production` TINYINT(1) NOT NULL DEFAULT 0,
    `break_only` TINYINT(1) NOT NULL DEFAULT 0,
    `pending` TINYINT(1) NOT NULL DEFAULT 0,
    `client_token` CHAR(36) NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    KEY `idx_trips_user_id` (`user_id`),
    KEY `idx_trips_user_start` (`user_id`, `start_time`),
    UNIQUE KEY `uq_trips_client_token` (`client_token`),
    CONSTRAINT `fk_trips_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT `chk_trips_time_order`
        CHECK (`end_time` > `start_time`),
    CONSTRAINT `chk_trips_standard_time`
        CHECK ((`break_only` = 1 AND `standard_time_ms` IS NULL AND `non_production` = 0) OR (`break_only` = 0 AND `standard_time_ms` IS NOT NULL AND `standard_time_ms` > 0)),
    CONSTRAINT `chk_trips_non_production`
        CHECK (`non_production` IN (0, 1)),
    CONSTRAINT `chk_trips_pending`
        CHECK (`pending` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_types` (
    `id` SMALLINT UNSIGNED NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `reconstruction` TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_event_types_name` (`name`),
    CONSTRAINT `chk_event_types_reconstruction`
        CHECK (`reconstruction` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `trip_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `trip_id` BIGINT UNSIGNED NOT NULL,
    `event_type_id` SMALLINT UNSIGNED NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `value` JSON NOT NULL,
    `client_token` CHAR(36) NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    KEY `idx_trip_events_trip_id` (`trip_id`),
    KEY `idx_trip_events_event_type_id` (`event_type_id`),
    KEY `idx_trip_events_trip_time` (`trip_id`, `timestamp`, `id`),
    UNIQUE KEY `uq_trip_events_client_token` (`client_token`),
    CONSTRAINT `fk_trip_events_trip`
        FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT `fk_trip_events_event_type`
        FOREIGN KEY (`event_type_id`) REFERENCES `event_types` (`id`)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `log` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `timestamp` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `user_id` BIGINT UNSIGNED NOT NULL,
    `action` ENUM('add', 'edit', 'delete') NOT NULL,
    `table_name` VARCHAR(64) NOT NULL,
    `record_id` BIGINT UNSIGNED NOT NULL,
    `before_data` LONGTEXT NULL,
    `after_data` LONGTEXT NULL,
    `change_id` CHAR(36) NOT NULL,
    `sequence` INT UNSIGNED NOT NULL,
    `reversal_of` CHAR(36) NULL,
    PRIMARY KEY (`id`),
    KEY `idx_log_timestamp` (`timestamp`),
    KEY `idx_log_user_id` (`user_id`),
    KEY `idx_log_change_id` (`change_id`, `sequence`),
    KEY `idx_log_record` (`table_name`, `record_id`),
    KEY `idx_log_reversal_of` (`reversal_of`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `event_types`
    (`id`, `name`, `description`, `reconstruction`)
VALUES
    (1, 'trip.started', 'Trip start was committed.', 1),
    (2, 'trip.stopped', 'Trip stop was committed.', 1),
    (3, 'trip.standard-time-changed', 'Trip standard time changed.', 0),
    (4, 'trip.creation-date-changed', 'Trip creation date anchor changed.', 0),
    (5, 'trip.creation-time-changed', 'Trip creation time changed.', 0),
    (6, 'trip.scheduled-start-changed', 'Trip scheduled start changed.', 0),
    (7, 'trip.start-time-changed', 'Trip start time changed.', 0),
    (8, 'trip.interval-elapsed-behavior-changed', 'Interval elapsed behavior changed.', 0),
    (9, 'trip.auto-restart-after-late-break-changed', 'Automatic restart after a late break changed.', 0),
    (10, 'interval.started', 'An interval started.', 1),
    (11, 'interval.ended', 'An interval ended.', 1),
    (12, 'interval.elapsed', 'An interval reached its planned boundary.', 0),
    (13, 'interval.approval-changed', 'An interval approval value changed.', 0),
    (14, 'interval.deleted', 'An interval was deleted.', 0),
    (15, 'trip.official-percent-set', 'Completed trip official percentage reconciliation.', 0),
    (16, 'trip.official-percent-cleared', 'Completed trip official percentage cleared.', 0)
ON DUPLICATE KEY UPDATE
    `description` = VALUES(`description`),
    `reconstruction` = VALUES(`reconstruction`);