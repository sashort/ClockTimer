<?php
declare(strict_types=1);

return [
    "INSERT INTO permissions (value, name, description) VALUES
        (32, 'grant_token_access', 'Create and manage temporary delegated-access tokens.')
    ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)",
    "CREATE TABLE IF NOT EXISTS access_tokens (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        owner_user_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(191) NOT NULL,
        token_hash CHAR(64) NOT NULL,
        token_hint VARCHAR(24) NOT NULL,
        permissions BIGINT UNSIGNED NOT NULL,
        uses_remaining INT UNSIGNED NOT NULL DEFAULT 1,
        delete_on_deplete TINYINT(1) NOT NULL DEFAULT 1,
        requires_authentication TINYINT(1) NOT NULL DEFAULT 1,
        expires_at BIGINT UNSIGNED NOT NULL,
        created_at BIGINT UNSIGNED NOT NULL,
        updated_at BIGINT UNSIGNED NOT NULL,
        last_used_at BIGINT UNSIGNED NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_access_tokens_hash (token_hash),
        KEY idx_access_tokens_owner (owner_user_id),
        KEY idx_access_tokens_expiry (expires_at),
        KEY idx_access_tokens_permission (permissions),
        CONSTRAINT fk_access_tokens_owner
            FOREIGN KEY (owner_user_id) REFERENCES users (id)
            ON UPDATE RESTRICT ON DELETE CASCADE,
        CONSTRAINT fk_access_tokens_permission
            FOREIGN KEY (permissions) REFERENCES permissions (value)
            ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT chk_access_tokens_delete_on_deplete
            CHECK (delete_on_deplete IN (0, 1)),
        CONSTRAINT chk_access_tokens_requires_authentication
            CHECK (requires_authentication IN (0, 1))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
];
