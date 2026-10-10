<?php
declare(strict_types=1);

return [
    "INSERT INTO permissions (value, name, description) VALUES
        (8, 'developer_preview', 'Access developer-preview tools and interfaces.'),
        (16, 'developer', 'Access developer tools and interfaces.')
    ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)",
];
