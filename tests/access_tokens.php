<?php
declare(strict_types=1);

class ApiFailure extends RuntimeException {
    public function __construct(
        public int $status,
        public string $apiCode
    ) {
        parent::__construct($apiCode);
    }
}

function api_error(
    string $message,
    int $status = 400,
    string $code = 'bad_request'
): never {
    throw new ApiFailure($status, $code);
}

class FixturePDO extends PDO {
    public function prepare(
        string $query,
        array $options = []
    ): PDOStatement|false {
        return parent::prepare(
            str_replace(
                ' FOR UPDATE',
                '',
                $query
            ),
            $options
        );
    }
}

$pdo = new FixturePDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

function db(): PDO {
    return $GLOBALS['pdo'];
}

require_once __DIR__ . '/../api/_core/permissions.php';
require_once __DIR__ . '/../api/_core/access_tokens.php';

$_SESSION = [];

$pdo->exec(
    'CREATE TABLE users ('
    . 'id INTEGER PRIMARY KEY, username TEXT, first_name TEXT, last_name TEXT, '
    . 'preferred_name TEXT, permissions INTEGER NOT NULL)'
);

$pdo->exec(
    'CREATE TABLE access_tokens ('
    . 'id INTEGER PRIMARY KEY AUTOINCREMENT, owner_user_id INTEGER NOT NULL, '
    . 'name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, token_hint TEXT NOT NULL, '
    . 'permissions INTEGER NOT NULL, uses_remaining INTEGER NOT NULL, '
    . 'delete_on_deplete INTEGER NOT NULL, requires_authentication INTEGER NOT NULL, '
    . 'expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, '
    . 'last_used_at INTEGER)'
);

$insertUser = $pdo->prepare(
    'INSERT INTO users '
    . '(id, username, first_name, last_name, preferred_name, permissions) '
    . 'VALUES (?, ?, ?, ?, NULL, ?)'
);

$insertUser->execute([
    1,
    'owner',
    'Token',
    'Owner',
    PERMISSION_GRANT_TOKEN_ACCESS | PERMISSION_DEVELOPER
]);

$insertUser->execute([
    2,
    'recipient',
    'Token',
    'Recipient',
    0
]);

$insertUser->execute([
    3,
    'grant-only',
    'Grant',
    'Only',
    PERMISSION_GRANT_TOKEN_ACCESS
]);

$passed = 0;

function test(
    string $name,
    callable $callback
): void {
    $callback();
    $GLOBALS['passed']++;
    echo "PASS $name" . PHP_EOL;
}

function expect(bool $condition): void {
    if (!$condition) {
        throw new RuntimeException(
            'Assertion failed'
        );
    }
}

function rejects(
    callable $callback,
    int $status,
    string $code
): void {
    try {
        $callback();
    } catch (ApiFailure $error) {
        expect(
            $error->status === $status &&
            $error->apiCode === $code
        );
        return;
    }

    throw new RuntimeException(
        'Expected API rejection'
    );
}

function seed_token(
    string $raw,
    int $owner,
    int $permission,
    int $counter,
    bool $deleteOnDeplete,
    bool $requiresAuthentication,
    ?int $expiresAt = null
): int {
    $statement = db()->prepare(
        'INSERT INTO access_tokens '
        . '(owner_user_id, name, token_hash, token_hint, permissions, uses_remaining, '
        . 'delete_on_deplete, requires_authentication, expires_at, created_at, updated_at) '
        . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    $now = time();

    $statement->execute([
        $owner,
        'Test token',
        access_token_hash($raw),
        'hint',
        $permission,
        $counter,
        $deleteOnDeplete ? 1 : 0,
        $requiresAuthentication ? 1 : 0,
        $expiresAt ?? ($now + 3600),
        $now,
        $now,
    ]);

    return (int) db()->lastInsertId();
}

function token_counter(int $id): ?int {
    $statement = db()->prepare(
        'SELECT uses_remaining FROM access_tokens WHERE id = ?'
    );
    $statement->execute([$id]);
    $value = $statement->fetchColumn();

    return $value === false
        ? null
        : (int) $value;
}

test(
    'generated token has WMOF prefix',
    fn() =>
        expect(
            str_starts_with(
                access_token_generate(),
                'wmof_'
            )
        )
);

$id = seed_token(
    'two-use',
    1,
    PERMISSION_DEVELOPER,
    2,
    false,
    false
);

test(
    'first use decrements counter',
    function () use ($id): void {
        $authorization =
            consume_access_token(
                'two-use',
                [PERMISSION_DEVELOPER],
                ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
            );

        expect(
            $authorization['uses_remaining'] === 1 &&
            token_counter($id) === 1
        );
    }
);

test(
    'counter reaches zero without going below zero',
    function () use ($id): void {
        $authorization =
            consume_access_token(
                'two-use',
                [PERMISSION_DEVELOPER],
                ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
            );

        expect(
            $authorization['uses_remaining'] === 0 &&
            token_counter($id) === 0
        );

        rejects(
            fn() =>
                consume_access_token(
                    'two-use',
                    [PERMISSION_DEVELOPER],
                    ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
                ),
            401,
            'depleted_access_token'
        );

        expect(token_counter($id) === 0);
    }
);

$deleteId = seed_token(
    'delete-last',
    1,
    PERMISSION_DEVELOPER,
    1,
    true,
    false
);

test(
    'delete on deplete removes last-use token',
    function () use ($deleteId): void {
        consume_access_token(
            'delete-last',
            [PERMISSION_DEVELOPER],
            ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
        );

        expect(
            token_counter($deleteId) === null
        );
    }
);

$authId = seed_token(
    'needs-login',
    1,
    PERMISSION_DEVELOPER,
    1,
    false,
    true
);

test(
    'requires authentication blocks anonymous use without consuming',
    function () use ($authId): void {
        $_SESSION = [];

        rejects(
            fn() =>
                consume_access_token(
                    'needs-login',
                    [PERMISSION_DEVELOPER],
                    ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
                ),
            401,
            'authentication_required'
        );

        expect(token_counter($authId) === 1);
    }
);

test(
    'requires authentication permits signed-in recipient',
    function () use ($authId): void {
        $_SESSION['user_id'] = 2;

        $authorization =
            consume_access_token(
                'needs-login',
                [PERMISSION_DEVELOPER],
                ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
            );

        expect(
            (int) $authorization['user']['id'] === 2 &&
            token_counter($authId) === 0
        );

        $_SESSION = [];
    }
);

seed_token(
    'bad-escalation',
    3,
    PERMISSION_DEVELOPER,
    1,
    false,
    false
);

test(
    'owner cannot delegate permission they no longer hold',
    fn() =>
        rejects(
            fn() =>
                consume_access_token(
                    'bad-escalation',
                    [PERMISSION_DEVELOPER],
                    ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
                ),
            403,
            'revoked_access_token'
        )
);

seed_token(
    'wrong-scope-permission',
    1,
    PERMISSION_DEVELOPER,
    1,
    false,
    false
);

test(
    'token must grant permission required by guarded endpoint',
    fn() =>
        rejects(
            fn() =>
                consume_access_token(
                    'wrong-scope-permission',
                    [PERMISSION_SUPERUSER],
                    ACCESS_TOKEN_SCOPE_SQL
                ),
            403,
            'permission_required'
        )
);

seed_token(
    'expired',
    1,
    PERMISSION_DEVELOPER,
    1,
    false,
    false,
    time() - 1
);

test(
    'expired token is rejected without consumption',
    fn() =>
        rejects(
            fn() =>
                consume_access_token(
                    'expired',
                    [PERMISSION_DEVELOPER],
                    ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
                ),
            401,
            'expired_access_token'
        )
);

$sessionId = seed_token(
    'session-token',
    1,
    PERMISSION_DEVELOPER,
    1,
    true,
    false
);

test(
    'form redemption can establish scoped grant after token row is deleted',
    function () use ($sessionId): void {
        $_SESSION = [];

        $authorization =
            consume_access_token(
                'session-token',
                [PERMISSION_DEVELOPER],
                ACCESS_TOKEN_SCOPE_SPEECH_EDITOR,
                true
            );

        expect(
            token_counter($sessionId) === null &&
            $authorization['mode'] === 'token_form'
        );

        $grant =
            access_token_session_grant(
                ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
            );

        expect(
            is_array($grant) &&
            (int) $grant['permissions'] ===
                PERMISSION_DEVELOPER
        );
    }
);

echo $passed . " tests passed." . PHP_EOL;
