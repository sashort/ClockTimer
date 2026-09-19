<?php
declare(strict_types=1);
return [
    'CREATE TABLE IF NOT EXISTS new_tokens (
        token_hash CHAR(64) NOT NULL PRIMARY KEY,
        admin_user_id BIGINT UNSIGNED NOT NULL,
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL,
        INDEX idx_new_tokens_expiry (expires_at),
        CONSTRAINT fk_new_tokens_admin FOREIGN KEY (admin_user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE CASCADE
    )',
];
