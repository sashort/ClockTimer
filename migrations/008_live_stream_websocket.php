<?php
declare(strict_types=1);

return [
    "CREATE TABLE IF NOT EXISTS live_stream_socket_tokens (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        created_at BIGINT UNSIGNED NOT NULL,
        expires_at BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_live_stream_socket_tokens_hash (token_hash),
        KEY idx_live_stream_socket_tokens_user (user_id, expires_at),
        KEY idx_live_stream_socket_tokens_expiry (expires_at),
        CONSTRAINT fk_live_stream_socket_tokens_user
            FOREIGN KEY (user_id) REFERENCES users (id)
            ON UPDATE RESTRICT ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
];
