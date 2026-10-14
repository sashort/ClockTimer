<?php
declare(strict_types=1);

return [
    "INSERT INTO permissions (value, name, description) VALUES
        (128, 'lookup_users', 'Search for user identities by ID, username, first name, last name, or preferred name.')
    ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)",
];
