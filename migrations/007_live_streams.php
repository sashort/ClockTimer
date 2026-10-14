<?php
declare(strict_types=1);

return [
    "INSERT INTO permissions (value, name, description) VALUES
        (64, 'view_live_streams', 'View another user\'s active live trip stream, including live audio and speech metadata.')
    ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)",

    "CREATE TABLE IF NOT EXISTS live_stream_sessions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        owner_user_id BIGINT UNSIGNED NOT NULL,
        snapshot MEDIUMTEXT NULL,
        created_at BIGINT UNSIGNED NOT NULL,
        updated_at BIGINT UNSIGNED NOT NULL,
        expires_at BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_live_stream_sessions_owner (owner_user_id),
        KEY idx_live_stream_sessions_expiry (expires_at),
        CONSTRAINT fk_live_stream_sessions_owner
            FOREIGN KEY (owner_user_id) REFERENCES users (id)
            ON UPDATE RESTRICT ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    "CREATE TABLE IF NOT EXISTS live_stream_peers (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        session_id BIGINT UNSIGNED NOT NULL,
        viewer_user_id BIGINT UNSIGNED NOT NULL,
        offer MEDIUMTEXT NOT NULL,
        answer MEDIUMTEXT NULL,
        state ENUM('pending', 'connected', 'closed') NOT NULL DEFAULT 'pending',
        created_at BIGINT UNSIGNED NOT NULL,
        updated_at BIGINT UNSIGNED NOT NULL,
        expires_at BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        KEY idx_live_stream_peers_session (session_id, state, id),
        KEY idx_live_stream_peers_viewer (viewer_user_id, id),
        KEY idx_live_stream_peers_expiry (expires_at),
        CONSTRAINT fk_live_stream_peers_session
            FOREIGN KEY (session_id) REFERENCES live_stream_sessions (id)
            ON UPDATE RESTRICT ON DELETE CASCADE,
        CONSTRAINT fk_live_stream_peers_viewer
            FOREIGN KEY (viewer_user_id) REFERENCES users (id)
            ON UPDATE RESTRICT ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    "CREATE TABLE IF NOT EXISTS live_stream_signals (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        peer_id BIGINT UNSIGNED NOT NULL,
        sender ENUM('publisher', 'viewer') NOT NULL,
        payload MEDIUMTEXT NOT NULL,
        created_at BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        KEY idx_live_stream_signals_peer (peer_id, id),
        KEY idx_live_stream_signals_created (created_at),
        CONSTRAINT fk_live_stream_signals_peer
            FOREIGN KEY (peer_id) REFERENCES live_stream_peers (id)
            ON UPDATE RESTRICT ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    "CREATE TABLE IF NOT EXISTS live_stream_messages (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        session_id BIGINT UNSIGNED NOT NULL,
        type VARCHAR(64) NOT NULL,
        payload MEDIUMTEXT NOT NULL,
        created_at BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        KEY idx_live_stream_messages_session (session_id, id),
        KEY idx_live_stream_messages_created (created_at),
        CONSTRAINT fk_live_stream_messages_session
            FOREIGN KEY (session_id) REFERENCES live_stream_sessions (id)
            ON UPDATE RESTRICT ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
];
