<?php
declare(strict_types=1);

class InviteFailure extends RuntimeException
{
}

function api_error(
    string $message,
    int $status = 400,
    string $code = 'bad_request'
): never {
    throw new InviteFailure($code . ': ' . $message, $status);
}

const PERMISSION_CREATE_USERS = 1;
const PERMISSION_MODIFY_USERS = 2;
const PERMISSION_SUPERUSER = 4;
const PERMISSION_DEVELOPER_PREVIEW = 8;
const PERMISSION_DEVELOPER = 16;
const PERMISSION_GRANT_TOKEN_ACCESS = 32;
const PERMISSION_ALL = 63;

require_once __DIR__ . '/../api/_core/access_tokens.php';
require_once __DIR__ . '/../api/_core/new_user_invites.php';

$pdo = new PDO(
    'sqlite::memory:',
    null,
    null,
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]
);

$pdo->exec(
    'CREATE TABLE access_tokens ('
    . 'id INTEGER PRIMARY KEY AUTOINCREMENT, owner_user_id INTEGER NULL, '
    . 'name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, token_hint TEXT NOT NULL, '
    . 'permissions INTEGER NOT NULL, new_user INTEGER NOT NULL, '
    . 'uses_remaining INTEGER NULL, delete_on_deplete INTEGER NOT NULL, '
    . 'requires_authentication INTEGER NOT NULL, expires_at INTEGER NOT NULL, '
    . 'created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_used_at INTEGER NULL)'
);

function invite_check(bool $value, string $name): void
{
    if (!$value) {
        throw new RuntimeException($name);
    }

    echo "PASS $name\n";
}

$single = create_new_user_token(
    $pdo,
    7,
    PERMISSION_DEVELOPER | PERMISSION_GRANT_TOKEN_ACCESS,
    false,
    1000
);
$singleRow = $pdo->query(
    'SELECT * FROM access_tokens ORDER BY id DESC LIMIT 1'
)->fetch();

invite_check(
    str_starts_with($single, 'wmof_') &&
    $singleRow['token_hash'] === access_token_hash($single) &&
    $singleRow['token_hash'] !== $single,
    'raw invitation token is not stored'
);

invite_check(
    (int) $singleRow['expires_at'] === 4600,
    'new-user invitation expires after one hour'
);

invite_check(
    (int) $singleRow['new_user'] === 1 &&
    (int) $singleRow['permissions'] ===
        (PERMISSION_DEVELOPER | PERMISSION_GRANT_TOKEN_ACCESS) &&
    (int) $singleRow['uses_remaining'] === 1 &&
    (int) $singleRow['delete_on_deplete'] === 1 &&
    (int) $singleRow['requires_authentication'] === 0,
    'single-use invitation uses unified access-token fields'
);

$multi = create_new_user_token(
    $pdo,
    7,
    PERMISSION_DEVELOPER,
    true,
    1200
);
$multiRow = $pdo->query(
    'SELECT * FROM access_tokens ORDER BY id DESC LIMIT 1'
)->fetch();

invite_check(
    $multiRow['uses_remaining'] === null &&
    (int) $multiRow['delete_on_deplete'] === 0 &&
    (int) $multiRow['expires_at'] === 4800,
    'multi-use invitation is unlimited until its one-hour expiration'
);

$replacement = replace_new_user_token(
    $pdo,
    7,
    $multi,
    PERMISSION_GRANT_TOKEN_ACCESS,
    false,
    1300
);
$old = $pdo->prepare(
    'SELECT COUNT(*) FROM access_tokens WHERE token_hash = ?'
);
$old->execute([access_token_hash($multi)]);
$replacementRow = $pdo->query(
    'SELECT * FROM access_tokens ORDER BY id DESC LIMIT 1'
)->fetch();

invite_check(
    $replacement !== $multi &&
    (int) $old->fetchColumn() === 0 &&
    (int) $replacementRow['permissions'] === PERMISSION_GRANT_TOKEN_ACCESS &&
    (int) $replacementRow['uses_remaining'] === 1,
    'regenerate replaces the previous invitation with current options'
);
