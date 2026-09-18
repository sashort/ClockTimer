<?php
declare(strict_types=1);
return [
    'CREATE TABLE IF NOT EXISTS calendar_rules (
        profile VARCHAR(64) NOT NULL,
        definition_hash VARCHAR(64) NOT NULL,
        calendar_year INTEGER NOT NULL,
        record_json TEXT NOT NULL,
        verified_at BIGINT NOT NULL,
        PRIMARY KEY (profile, definition_hash, calendar_year)
    )',
    'CREATE TABLE IF NOT EXISTS calendar_refresh_attempts (
        profile VARCHAR(64) NOT NULL PRIMARY KEY,
        attempted_at BIGINT NOT NULL
    )',
];
