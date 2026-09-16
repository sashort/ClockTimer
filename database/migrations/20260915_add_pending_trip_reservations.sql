ALTER TABLE `trips`
    ADD COLUMN `pending` TINYINT(1) NOT NULL DEFAULT 0 AFTER `non_production`,
    ADD COLUMN `client_token` CHAR(36) NULL AFTER `pending`,
    ADD UNIQUE KEY `uq_trips_client_token` (`client_token`),
    ADD CONSTRAINT `chk_trips_pending` CHECK (`pending` IN (0, 1));
