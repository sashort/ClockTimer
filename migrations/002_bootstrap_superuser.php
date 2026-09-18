<?php
declare(strict_types=1);

// Authorized initial superuser. This grant runs once and is not repeated on deploy.
return [
    "UPDATE users SET permissions = permissions | 4 WHERE id = 2 AND username = 'bobthebuilder'",
];
