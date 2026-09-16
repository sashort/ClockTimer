-- Trip Management System database schema
-- Target: MariaDB / MySQL on a LAMP stack
--
-- PHP application responsibilities:
--   * Authenticate users and retain users.id in the PHP session.
--   * Create trips and intervals with normal INSERT statements.
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

CREATE TABLE IF NOT EXISTS `trips` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NOT NULL,
    `standard_time_ms` BIGINT UNSIGNED NOT NULL,
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

CREATE TABLE IF NOT EXISTS `intervals` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `trip_id` BIGINT UNSIGNED NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NULL,
    PRIMARY KEY (`id`),
    KEY `idx_intervals_trip_id` (`trip_id`),
    KEY `idx_intervals_trip_time` (`trip_id`, `start_time`, `end_time`),
    CONSTRAINT `fk_intervals_trip`
        FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT `chk_intervals_type_not_empty`
        CHECK (CHAR_LENGTH(TRIM(`type`)) > 0),
    CONSTRAINT `chk_intervals_time_order`
        CHECK (`end_time` IS NULL OR `end_time` > `start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `attributes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `interval_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_attributes_interval_name` (`interval_id`, `name`),
    KEY `idx_attributes_interval_id` (`interval_id`),
    CONSTRAINT `fk_attributes_interval`
        FOREIGN KEY (`interval_id`) REFERENCES `intervals` (`id`)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT `chk_attributes_name_not_empty`
        CHECK (CHAR_LENGTH(TRIM(`name`)) > 0)
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
DROP TRIGGER IF EXISTS `audit_intervals_add`;
DROP TRIGGER IF EXISTS `audit_intervals_edit`;
DROP TRIGGER IF EXISTS `audit_intervals_delete`;
DROP TRIGGER IF EXISTS `audit_attributes_add`;
DROP TRIGGER IF EXISTS `audit_attributes_edit`;
DROP TRIGGER IF EXISTS `audit_attributes_delete`;
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
             'non_production', NEW.`non_production`,
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
             'non_production', OLD.`non_production`,
             'created_at', OLD.`created_at`
         ),
         JSON_OBJECT(
             'id', NEW.`id`,
             'user_id', NEW.`user_id`,
             'start_time', NEW.`start_time`,
             'end_time', NEW.`end_time`,
             'standard_time_ms', NEW.`standard_time_ms`,
             'non_production', NEW.`non_production`,
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
             'non_production', OLD.`non_production`,
             'created_at', OLD.`created_at`
         ),
         NULL,
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
END$$

CREATE TRIGGER `audit_intervals_add`
AFTER INSERT ON `intervals`
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
        (@audit_user_id, 'add', 'intervals', NEW.`id`, NULL,
         JSON_OBJECT(
             'id', NEW.`id`,
             'trip_id', NEW.`trip_id`,
             'type', NEW.`type`,
             'start_time', NEW.`start_time`,
             'end_time', NEW.`end_time`
         ),
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
END$$

CREATE TRIGGER `audit_intervals_edit`
AFTER UPDATE ON `intervals`
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
        (@audit_user_id, 'edit', 'intervals', NEW.`id`,
         JSON_OBJECT(
             'id', OLD.`id`,
             'trip_id', OLD.`trip_id`,
             'type', OLD.`type`,
             'start_time', OLD.`start_time`,
             'end_time', OLD.`end_time`
         ),
         JSON_OBJECT(
             'id', NEW.`id`,
             'trip_id', NEW.`trip_id`,
             'type', NEW.`type`,
             'start_time', NEW.`start_time`,
             'end_time', NEW.`end_time`
         ),
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
END$$

CREATE TRIGGER `audit_intervals_delete`
AFTER DELETE ON `intervals`
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
        (@audit_user_id, 'delete', 'intervals', OLD.`id`,
         JSON_OBJECT(
             'id', OLD.`id`,
             'trip_id', OLD.`trip_id`,
             'type', OLD.`type`,
             'start_time', OLD.`start_time`,
             'end_time', OLD.`end_time`
         ),
         NULL,
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
END$$

CREATE TRIGGER `audit_attributes_add`
AFTER INSERT ON `attributes`
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
        (@audit_user_id, 'add', 'attributes', NEW.`id`, NULL,
         JSON_OBJECT(
             'id', NEW.`id`,
             'interval_id', NEW.`interval_id`,
             'name', NEW.`name`,
             'value', NEW.`value`
         ),
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
END$$

CREATE TRIGGER `audit_attributes_edit`
AFTER UPDATE ON `attributes`
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
        (@audit_user_id, 'edit', 'attributes', NEW.`id`,
         JSON_OBJECT(
             'id', OLD.`id`,
             'interval_id', OLD.`interval_id`,
             'name', OLD.`name`,
             'value', OLD.`value`
         ),
         JSON_OBJECT(
             'id', NEW.`id`,
             'interval_id', NEW.`interval_id`,
             'name', NEW.`name`,
             'value', NEW.`value`
         ),
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
END$$

CREATE TRIGGER `audit_attributes_delete`
AFTER DELETE ON `attributes`
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
        (@audit_user_id, 'delete', 'attributes', OLD.`id`,
         JSON_OBJECT(
             'id', OLD.`id`,
             'interval_id', OLD.`interval_id`,
             'name', OLD.`name`,
             'value', OLD.`value`
         ),
         NULL,
         @audit_change_id, @audit_sequence, NULLIF(@audit_reversal_of, ''));
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
