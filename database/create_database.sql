-- Trip Management System database schema
-- Target: MariaDB / MySQL on a LAMP stack
--
-- PHP application responsibilities:
--   * Authenticate users and retain users.id in the PHP session.
--   * Create trips and append trip events with normal INSERT statements.
--   * Read generated IDs with mysqli_insert_id() / PDO::lastInsertId().
--   * Before audited writes on a connection, set:
--       SET @audit_user_id = <users.id>;
--       SET @audit_change_id = '<uuid>';
--       SET @audit_sequence = 0;
--       SET @audit_reversal_of = NULL;
--   * For bootstrap/system operations, explicitly use @audit_user_id = 0.
--   * For a reversal, use a new @audit_change_id and set
--     @audit_reversal_of to the original change_id being reversed.
--
-- Important:
--   Audited parent/child foreign keys use ON DELETE RESTRICT instead of CASCADE.
--   MySQL/MariaDB foreign-key cascades can bypass child-table triggers, which
--   would prevent complete deleted-row snapshots from being written to `log`.
--   Delete dependent rows explicitly in PHP, within one transaction/change_id.

CREATE DATABASE IF NOT EXISTS `trip_management`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `trip_management`;

CREATE TABLE IF NOT EXISTS `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `preferred_name` VARCHAR(100) NULL,
    `username` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `permissions` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `permissions` (
    `value` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    PRIMARY KEY (`value`),
    UNIQUE KEY `uq_permissions_name` (`name`),
    CONSTRAINT `chk_permissions_power_of_two`
        CHECK (`value` > 0 AND (`value` & (`value` - 1)) = 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `access_tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    -- NULL means the token was created by an anonymous delegated session.
    -- These are system tokens and are manageable by superusers.
    `owner_user_id` BIGINT UNSIGNED NULL,
    `name` VARCHAR(191) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `token_hint` VARCHAR(24) NOT NULL,
    -- Bitmask assembled from rows in permissions. Combinations do not need
    -- their own permissions-table row.
    `permissions` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    -- New User is the special value-0 capability. When set, permissions is
    -- the initial permission mask assigned to accounts created by the token.
    `new_user` TINYINT(1) NOT NULL DEFAULT 0,
    -- NULL means unlimited uses until expires_at.
    `uses_remaining` INT UNSIGNED NULL DEFAULT NULL,
    `delete_on_deplete` TINYINT(1) NOT NULL DEFAULT 0,
    `requires_authentication` TINYINT(1) NOT NULL DEFAULT 1,
    `expires_at` BIGINT UNSIGNED NOT NULL,
    `created_at` BIGINT UNSIGNED NOT NULL,
    `updated_at` BIGINT UNSIGNED NOT NULL,
    `last_used_at` BIGINT UNSIGNED NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_access_tokens_hash` (`token_hash`),
    KEY `idx_access_tokens_owner` (`owner_user_id`),
    KEY `idx_access_tokens_expiry` (`expires_at`),
    KEY `idx_access_tokens_permission` (`permissions`),
    CONSTRAINT `fk_access_tokens_owner`
        FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT `chk_access_tokens_new_user`
        CHECK (`new_user` IN (0, 1)),
    CONSTRAINT `chk_access_tokens_delete_on_deplete`
        CHECK (`delete_on_deplete` IN (0, 1)),
    CONSTRAINT `chk_access_tokens_count_delete`
        CHECK (`uses_remaining` IS NOT NULL OR `delete_on_deplete` = 0),
    CONSTRAINT `chk_access_tokens_requires_authentication`
        CHECK (`requires_authentication` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `speech_corrections` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `language` VARCHAR(32) NOT NULL DEFAULT 'en-US',
    `observed` VARCHAR(500) NOT NULL,
    `observed_compact` VARCHAR(500) NOT NULL,
    `canonical` VARCHAR(500) NOT NULL,
    `canonical_compact` VARCHAR(500) NOT NULL,
    `match_type` ENUM('exact', 'prefix') NOT NULL DEFAULT 'exact',
    `enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `occurrences` INT UNSIGNED NOT NULL DEFAULT 1,
    `created_by_user_id` BIGINT UNSIGNED NULL,
    `created_at` BIGINT UNSIGNED NOT NULL,
    `updated_at` BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_speech_corrections_mapping`
        (`language`, `observed_compact`, `canonical_compact`, `match_type`),
    KEY `idx_speech_corrections_runtime`
        (`language`, `enabled`, `observed_compact`),
    KEY `idx_speech_corrections_creator` (`created_by_user_id`),
    CONSTRAINT `fk_speech_corrections_creator`
        FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`)
        ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT `chk_speech_corrections_enabled`
        CHECK (`enabled` IN (0, 1)),
    CONSTRAINT `chk_speech_corrections_occurrences`
        CHECK (`occurrences` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `speech_training_samples` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `language` VARCHAR(32) NOT NULL DEFAULT 'en-US',
    `phrase_key` VARCHAR(500) NOT NULL,
    `phrase_key_hash` CHAR(64) NOT NULL,
    `phrase` VARCHAR(500) NOT NULL,
    `canonical` VARCHAR(500) NOT NULL,
    `canonical_compact` VARCHAR(500) NOT NULL,
    `observed` VARCHAR(500) NOT NULL,
    `observed_compact` VARCHAR(500) NOT NULL,
    `recognized_correct` TINYINT(1) NOT NULL,
    `created_by_user_id` BIGINT UNSIGNED NULL,
    `created_at` BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_speech_training_phrase`
        (`language`, `phrase_key_hash`, `created_at`),
    KEY `idx_speech_training_creator` (`created_by_user_id`),
    CONSTRAINT `fk_speech_training_creator`
        FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`)
        ON UPDATE RESTRICT ON DELETE SET NULL,
    CONSTRAINT `chk_speech_training_correct`
        CHECK (`recognized_correct` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `trips` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NOT NULL,
    `standard_time_ms` BIGINT UNSIGNED NOT NULL,
    `counted_time_ms` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `non_production` TINYINT(1) NOT NULL DEFAULT 0,
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
        CHECK (`standard_time_ms` > 0),
    CONSTRAINT `chk_trips_non_production`
        CHECK (`non_production` IN (0, 1)),
    CONSTRAINT `chk_trips_pending`
        CHECK (`pending` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reclaimed_trip_ids` (
    `id` BIGINT UNSIGNED NOT NULL,
    `reclaimed_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`)
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
    (14, 'interval.deleted', 'An interval was deleted.', 0)
ON DUPLICATE KEY UPDATE
    `description` = VALUES(`description`),
    `reconstruction` = VALUES(`reconstruction`);

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

CREATE TABLE IF NOT EXISTS `down_interval_notes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `trip_id` BIGINT UNSIGNED NOT NULL,
    `interval_key` VARCHAR(191) NOT NULL,
    `notes` TEXT NOT NULL,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY `idx_down_notes` (`trip_id`, `interval_key`, `id`),
    CONSTRAINT `fk_down_notes_trip` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `down_interval_images` (
    `trip_id` BIGINT UNSIGNED NOT NULL,
    `interval_key` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(80) NOT NULL,
    `image` MEDIUMBLOB NOT NULL,
    `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`trip_id`, `interval_key`),
    CONSTRAINT `fk_down_images_trip` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The audit log deliberately has no foreign key on user_id. Historical records
-- must retain the actor's numeric ID even if that user is later deleted.
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

-- Re-running this script refreshes trigger definitions without dropping data.
DROP TRIGGER IF EXISTS `audit_users_add`;
DROP TRIGGER IF EXISTS `audit_users_edit`;
DROP TRIGGER IF EXISTS `audit_users_delete`;
DROP TRIGGER IF EXISTS `audit_permissions_add`;
DROP TRIGGER IF EXISTS `audit_permissions_edit`;
DROP TRIGGER IF EXISTS `audit_permissions_delete`;
DROP TRIGGER IF EXISTS `audit_trips_add`;
DROP TRIGGER IF EXISTS `audit_trips_edit`;
DROP TRIGGER IF EXISTS `audit_trips_delete`;
DROP TRIGGER IF EXISTS `audit_trip_events_add`;
DROP TRIGGER IF EXISTS `audit_trip_events_delete`;
DROP TRIGGER IF EXISTS `protect_trip_events_update`;
DROP TRIGGER IF EXISTS `protect_log_update`;
DROP TRIGGER IF EXISTS `protect_log_delete`;

DELIMITER $$

CREATE TRIGGER `audit_users_add`
AFTER INSERT ON `users`
FOR EACH ROW
BEGIN
    IF @audit_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit user context is required';
    END IF;
    IF @audit_change_id IS NULL OR CHAR_LENGTH(TRIM(@audit_change_id)) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit change id is required';
    END IF;
    SET @audit_sequence = COALESCE(@audit_sequence, 0) + 1;
    INSERT INTO `log`
        (`user_id`, `action`, `table_name`, `record_id`, `before_data`, `after_data`, `change_id`, `sequence`, `reversal_of`)
    VALUES
        (@audit_user_id, 'add', 'users', NEW.`id`, NULL,
         JSON_OBJECT(
             'id', NEW.`id`,
             'first_name', NEW.`first_name`,
             'last_name', NEW.`last_name`,
             'preferred_name', NEW.`preferred_name`,
             'username', NEW.`username`,
             'password_hash', NEW.`password_hash`,
             'permissions', NEW.`permissions`
         ),
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
END$$

CREATE TRIGGER `audit_users_edit`
AFTER UPDATE ON `users`
FOR EACH ROW
BEGIN
    IF @audit_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit user context is required';
    END IF;
    IF @audit_change_id IS NULL OR CHAR_LENGTH(TRIM(@audit_change_id)) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit change id is required';
    END IF;
    SET @audit_sequence = COALESCE(@audit_sequence, 0) + 1;
    INSERT INTO `log`
        (`user_id`, `action`, `table_name`, `record_id`, `before_data`, `after_data`, `change_id`, `sequence`, `reversal_of`)
    VALUES
        (@audit_user_id, 'edit', 'users', NEW.`id`,
         JSON_OBJECT(
             'id', OLD.`id`,
             'first_name', OLD.`first_name`,
             'last_name', OLD.`last_name`,
             'preferred_name', OLD.`preferred_name`,
             'username', OLD.`username`,
             'password_hash', OLD.`password_hash`,
             'permissions', OLD.`permissions`
         ),
         JSON_OBJECT(
             'id', NEW.`id`,
             'first_name', NEW.`first_name`,
             'last_name', NEW.`last_name`,
             'preferred_name', NEW.`preferred_name`,
             'username', NEW.`username`,
             'password_hash', NEW.`password_hash`,
             'permissions', NEW.`permissions`
         ),
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
END$$

CREATE TRIGGER `audit_users_delete`
AFTER DELETE ON `users`
FOR EACH ROW
BEGIN
    IF @audit_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit user context is required';
    END IF;
    IF @audit_change_id IS NULL OR CHAR_LENGTH(TRIM(@audit_change_id)) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit change id is required';
    END IF;
    SET @audit_sequence = COALESCE(@audit_sequence, 0) + 1;
    INSERT INTO `log`
        (`user_id`, `action`, `table_name`, `record_id`, `before_data`, `after_data`, `change_id`, `sequence`, `reversal_of`)
    VALUES
        (@audit_user_id, 'delete', 'users', OLD.`id`,
         JSON_OBJECT(
             'id', OLD.`id`,
             'first_name', OLD.`first_name`,
             'last_name', OLD.`last_name`,
             'preferred_name', OLD.`preferred_name`,
             'username', OLD.`username`,
             'password_hash', OLD.`password_hash`,
             'permissions', OLD.`permissions`
         ),
         NULL,
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
END$$

CREATE TRIGGER `audit_permissions_add`
AFTER INSERT ON `permissions`
FOR EACH ROW
BEGIN
    IF @audit_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit user context is required';
    END IF;
    IF @audit_change_id IS NULL OR CHAR_LENGTH(TRIM(@audit_change_id)) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit change id is required';
    END IF;
    SET @audit_sequence = COALESCE(@audit_sequence, 0) + 1;
    INSERT INTO `log`
        (`user_id`, `action`, `table_name`, `record_id`, `before_data`, `after_data`, `change_id`, `sequence`, `reversal_of`)
    VALUES
        (@audit_user_id, 'add', 'permissions', NEW.`value`, NULL,
         JSON_OBJECT(
             'value', NEW.`value`,
             'name', NEW.`name`,
             'description', NEW.`description`
         ),
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
END$$

CREATE TRIGGER `audit_permissions_edit`
AFTER UPDATE ON `permissions`
FOR EACH ROW
BEGIN
    IF @audit_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit user context is required';
    END IF;
    IF @audit_change_id IS NULL OR CHAR_LENGTH(TRIM(@audit_change_id)) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit change id is required';
    END IF;
    SET @audit_sequence = COALESCE(@audit_sequence, 0) + 1;
    INSERT INTO `log`
        (`user_id`, `action`, `table_name`, `record_id`, `before_data`, `after_data`, `change_id`, `sequence`, `reversal_of`)
    VALUES
        (@audit_user_id, 'edit', 'permissions', NEW.`value`,
         JSON_OBJECT(
             'value', OLD.`value`,
             'name', OLD.`name`,
             'description', OLD.`description`
         ),
         JSON_OBJECT(
             'value', NEW.`value`,
             'name', NEW.`name`,
             'description', NEW.`description`
         ),
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
END$$

CREATE TRIGGER `audit_permissions_delete`
AFTER DELETE ON `permissions`
FOR EACH ROW
BEGIN
    IF @audit_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit user context is required';
    END IF;
    IF @audit_change_id IS NULL OR CHAR_LENGTH(TRIM(@audit_change_id)) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit change id is required';
    END IF;
    SET @audit_sequence = COALESCE(@audit_sequence, 0) + 1;
    INSERT INTO `log`
        (`user_id`, `action`, `table_name`, `record_id`, `before_data`, `after_data`, `change_id`, `sequence`, `reversal_of`)
    VALUES
        (@audit_user_id, 'delete', 'permissions', OLD.`value`,
         JSON_OBJECT(
             'value', OLD.`value`,
             'name', OLD.`name`,
             'description', OLD.`description`
         ),
         NULL,
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
END$$

CREATE TRIGGER `audit_trips_add`
AFTER INSERT ON `trips`
FOR EACH ROW
BEGIN
    IF @audit_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit user context is required';
    END IF;
    IF @audit_change_id IS NULL OR CHAR_LENGTH(TRIM(@audit_change_id)) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit change id is required';
    END IF;
    SET @audit_sequence = COALESCE(@audit_sequence, 0) + 1;
    INSERT INTO `log`
        (`user_id`, `action`, `table_name`, `record_id`, `before_data`, `after_data`, `change_id`, `sequence`, `reversal_of`)
    VALUES
        (@audit_user_id, 'add', 'trips', NEW.`id`, NULL,
         JSON_OBJECT(
             'id', NEW.`id`,
             'user_id', NEW.`user_id`,
             'start_time', NEW.`start_time`,
             'end_time', NEW.`end_time`,
             'standard_time_ms', NEW.`standard_time_ms`,
             'counted_time_ms', NEW.`counted_time_ms`,
             'non_production', NEW.`non_production`,
             'pending', NEW.`pending`,
             'client_token', NEW.`client_token`,
             'created_at', NEW.`created_at`
         ),
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
END$$

CREATE TRIGGER `audit_trips_edit`
AFTER UPDATE ON `trips`
FOR EACH ROW
BEGIN
    IF @audit_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit user context is required';
    END IF;
    IF @audit_change_id IS NULL OR CHAR_LENGTH(TRIM(@audit_change_id)) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit change id is required';
    END IF;
    SET @audit_sequence = COALESCE(@audit_sequence, 0) + 1;
    INSERT INTO `log`
        (`user_id`, `action`, `table_name`, `record_id`, `before_data`, `after_data`, `change_id`, `sequence`, `reversal_of`)
    VALUES
        (@audit_user_id, 'edit', 'trips', NEW.`id`,
         JSON_OBJECT(
             'id', OLD.`id`,
             'user_id', OLD.`user_id`,
             'start_time', OLD.`start_time`,
             'end_time', OLD.`end_time`,
             'standard_time_ms', OLD.`standard_time_ms`,
             'counted_time_ms', OLD.`counted_time_ms`,
             'non_production', OLD.`non_production`,
             'pending', OLD.`pending`,
             'client_token', OLD.`client_token`,
             'created_at', OLD.`created_at`
         ),
         JSON_OBJECT(
             'id', NEW.`id`,
             'user_id', NEW.`user_id`,
             'start_time', NEW.`start_time`,
             'end_time', NEW.`end_time`,
             'standard_time_ms', NEW.`standard_time_ms`,
             'counted_time_ms', NEW.`counted_time_ms`,
             'non_production', NEW.`non_production`,
             'pending', NEW.`pending`,
             'client_token', NEW.`client_token`,
             'created_at', NEW.`created_at`
         ),
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
END$$

CREATE TRIGGER `audit_trips_delete`
AFTER DELETE ON `trips`
FOR EACH ROW
BEGIN
    IF @audit_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit user context is required';
    END IF;
    IF @audit_change_id IS NULL OR CHAR_LENGTH(TRIM(@audit_change_id)) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit change id is required';
    END IF;
    SET @audit_sequence = COALESCE(@audit_sequence, 0) + 1;
    INSERT INTO `log`
        (`user_id`, `action`, `table_name`, `record_id`, `before_data`, `after_data`, `change_id`, `sequence`, `reversal_of`)
    VALUES
        (@audit_user_id, 'delete', 'trips', OLD.`id`,
         JSON_OBJECT(
             'id', OLD.`id`,
             'user_id', OLD.`user_id`,
             'start_time', OLD.`start_time`,
             'end_time', OLD.`end_time`,
             'standard_time_ms', OLD.`standard_time_ms`,
             'counted_time_ms', OLD.`counted_time_ms`,
             'non_production', OLD.`non_production`,
             'pending', OLD.`pending`,
             'client_token', OLD.`client_token`,
             'created_at', OLD.`created_at`
         ),
         NULL,
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
END$$

CREATE TRIGGER `audit_trip_events_add`
AFTER INSERT ON `trip_events`
FOR EACH ROW
BEGIN
    IF @audit_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit user context is required';
    END IF;
    IF @audit_change_id IS NULL OR CHAR_LENGTH(TRIM(@audit_change_id)) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit change id is required';
    END IF;
    SET @audit_sequence = COALESCE(@audit_sequence, 0) + 1;
    INSERT INTO `log`
        (`user_id`, `action`, `table_name`, `record_id`, `before_data`, `after_data`, `change_id`, `sequence`, `reversal_of`)
    VALUES
        (@audit_user_id, 'add', 'trip_events', NEW.`id`, NULL,
         JSON_OBJECT(
             'id', NEW.`id`,
             'trip_id', NEW.`trip_id`,
             'event_type_id', NEW.`event_type_id`,
             'timestamp', NEW.`timestamp`,
             'value', NEW.`value`,
             'client_token', NEW.`client_token`,
             'created_at', NEW.`created_at`
         ),
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
END$$

CREATE TRIGGER `audit_trip_events_delete`
AFTER DELETE ON `trip_events`
FOR EACH ROW
BEGIN
    IF @audit_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit user context is required';
    END IF;
    IF @audit_change_id IS NULL OR CHAR_LENGTH(TRIM(@audit_change_id)) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit change id is required';
    END IF;
    SET @audit_sequence = COALESCE(@audit_sequence, 0) + 1;
    INSERT INTO `log`
        (`user_id`, `action`, `table_name`, `record_id`, `before_data`, `after_data`, `change_id`, `sequence`, `reversal_of`)
    VALUES
        (@audit_user_id, 'delete', 'trip_events', OLD.`id`,
         JSON_OBJECT(
             'id', OLD.`id`,
             'trip_id', OLD.`trip_id`,
             'event_type_id', OLD.`event_type_id`,
             'timestamp', OLD.`timestamp`,
             'value', OLD.`value`,
             'client_token', OLD.`client_token`,
             'created_at', OLD.`created_at`
         ),
         NULL,
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
END$$

CREATE TRIGGER `protect_trip_events_update`
BEFORE UPDATE ON `trip_events`
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Trip events are immutable';
END$$

-- Audit history is append-only. Reversals create new normal data changes and
-- therefore new log entries; they never modify or erase existing history.
CREATE TRIGGER `protect_log_update`
BEFORE UPDATE ON `log`
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit log entries are immutable';
END$$

CREATE TRIGGER `protect_log_delete`
BEFORE DELETE ON `log`
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit log entries are immutable';
END$$

DELIMITER ;

-- Example PHP transaction context (execute on the same DB connection used for
-- all statements in the operation):
--
-- START TRANSACTION;
-- SET @audit_user_id = 123;
-- SET @audit_change_id = UUID();
-- SET @audit_sequence = 0;
-- SET @audit_reversal_of = NULL;
--
-- -- INSERT / UPDATE / DELETE statements here.
--
-- COMMIT;
-- SET @audit_user_id = NULL;
-- SET @audit_change_id = NULL;
-- SET @audit_sequence = NULL;
-- SET @audit_reversal_of = NULL;
--
-- Reversal guidance:
--   * Read the original change's log rows in sequence order.
--   * Reverse an original add by deleting after_data's row.
--   * Reverse an original edit by restoring before_data.
--   * Reverse an original delete by reinserting before_data, including its ID.
--   * Process the original change in reverse sequence order so dependencies are
--     unwound correctly, and let the reversal generate its own audit entries.
