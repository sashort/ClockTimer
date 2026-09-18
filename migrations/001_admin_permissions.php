<?php
declare(strict_types=1);

// Each array entry is one complete SQL statement. No semicolon splitting.
return [
    "INSERT INTO permissions (value, name, description) VALUES
        (1, 'create_users', 'Create user accounts.'),
        (2, 'modify_users', 'Modify other non-superuser accounts. Own account editing is implicit.'),
        (4, 'superuser', 'All account permissions and guarded raw SQL access.')
    ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)",
];
