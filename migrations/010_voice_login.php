<?php
declare(strict_types=1);
return [
    "ALTER TABLE users ADD COLUMN login_id CHAR(4) NULL, ADD COLUMN pin_hash VARCHAR(255) NULL, ADD UNIQUE KEY users_login_id_unique (login_id)",
    "CREATE TABLE voice_login_attempts (bucket CHAR(64) NOT NULL PRIMARY KEY, window_start BIGINT NOT NULL, attempts INT NOT NULL DEFAULT 0) ENGINE=InnoDB",
];
