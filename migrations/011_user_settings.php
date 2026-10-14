<?php
declare(strict_types=1);
return [
    "ALTER TABLE users ADD COLUMN settings_json JSON NULL, ADD COLUMN settings_revision BIGINT UNSIGNED NOT NULL DEFAULT 0",
];
