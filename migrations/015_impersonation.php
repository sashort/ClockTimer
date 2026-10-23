<?php
declare(strict_types=1);
return [
    "INSERT INTO permissions (value, name, description) VALUES (256, 'impersonate', 'Sign in as another account with an audited identity transition.') ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description)",
    "CREATE TABLE IF NOT EXISTS impersonation_sessions (id CHAR(36) NOT NULL PRIMARY KEY, actor_user_id BIGINT UNSIGNED NULL, target_user_id BIGINT UNSIGNED NOT NULL, token_id BIGINT UNSIGNED NULL, authentication VARCHAR(16) NOT NULL, started_at BIGINT UNSIGNED NOT NULL, ended_at BIGINT UNSIGNED NULL, end_reason VARCHAR(32) NULL, INDEX impersonation_actor (actor_user_id, started_at), INDEX impersonation_target (target_user_id, started_at)) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS impersonation_changes (change_id CHAR(36) NOT NULL PRIMARY KEY, impersonation_id CHAR(36) NOT NULL, created_at BIGINT UNSIGNED NOT NULL, INDEX impersonation_changes_session (impersonation_id)) ENGINE=InnoDB"
];
