<?php
declare(strict_types=1);

class ApiFailure extends RuntimeException
{
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

class FixturePDO extends PDO
{
    public function prepare(
        string $query,
        array $options = []
    ): PDOStatement|false {
        return parent::prepare(
            str_replace(' FOR UPDATE', '', $query),
            $options
        );
    }
}

$pdo = new FixturePDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

function db(): PDO
{
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
    . 'id INTEGER PRIMARY KEY AUTOINCREMENT, owner_user_id INTEGER NULL, '
    . 'name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, token_hint TEXT NOT NULL, '
    . 'permissions INTEGER NOT NULL DEFAULT 0, new_user INTEGER NOT NULL DEFAULT 0, '
    . 'uses_remaining INTEGER NULL, delete_on_deplete INTEGER NOT NULL, '
    . 'requires_authentication INTEGER NOT NULL, expires_at INTEGER NOT NULL, '
    . 'created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_used_at INTEGER)'
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
    PERMISSION_CREATE_USERS |
        PERMISSION_GRANT_TOKEN_ACCESS |
        PERMISSION_DEVELOPER,
]);

$insertUser->execute([
    2,
    'recipient',
    'Token',
    'Recipient',
    0,
]);

$insertUser->execute([
    3,
    'grant-only',
    'Grant',
    'Only',
    PERMISSION_GRANT_TOKEN_ACCESS,
]);

$passed = 0;

function test(string $name, callable $callback): void
{
    $callback();
    $GLOBALS['passed']++;
    echo "PASS $name" . PHP_EOL;
}

function expect(bool $condition): void
{
    if (!$condition) {
        throw new RuntimeException('Assertion failed');
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

    throw new RuntimeException('Expected API rejection');
}

function seed_token(
    string $raw,
    ?int $owner,
    int $permissions,
    ?int $counter,
    bool $deleteOnDeplete,
    bool $requiresAuthentication,
    bool $newUser = false,
    ?int $expiresAt = null
): int {
    $statement = db()->prepare(
        'INSERT INTO access_tokens '
        . '(owner_user_id, name, token_hash, token_hint, permissions, new_user, '
        . 'uses_remaining, delete_on_deplete, requires_authentication, '
        . 'expires_at, created_at, updated_at) '
        . 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $now = time();
    $statement->execute([
        $owner,
        'Test token',
        access_token_hash($raw),
        'hint',
        $permissions,
        $newUser ? 1 : 0,
        $counter,
        $deleteOnDeplete ? 1 : 0,
        $requiresAuthentication ? 1 : 0,
        $expiresAt ?? ($now + 3600),
        $now,
        $now,
    ]);

    return (int) db()->lastInsertId();
}

function token_row(int $id): ?array
{
    $statement = db()->prepare(
        'SELECT * FROM access_tokens WHERE id = ?'
    );
    $statement->execute([$id]);
    $row = $statement->fetch();

    return $row ?: null;
}

test(
    'generated token has WMOF prefix',
    fn() => expect(str_starts_with(access_token_generate(), 'wmof_'))
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
    'counted token decrements and reports single final use',
    function () use ($id): void {
        $first = consume_access_token(
            'two-use',
            [PERMISSION_DEVELOPER],
            ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
        );
        expect(
            $first['uses_remaining'] === 1 &&
            $first['single_use'] === false &&
            (int) token_row($id)['uses_remaining'] === 1
        );

        $second = consume_access_token(
            'two-use',
            [PERMISSION_DEVELOPER],
            ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
        );
        expect(
            $second['uses_remaining'] === 0 &&
            $second['single_use'] === true &&
            (int) token_row($id)['uses_remaining'] === 0
        );

        rejects(
            fn() => consume_access_token(
                'two-use',
                [PERMISSION_DEVELOPER],
                ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
            ),
            401,
            'depleted_access_token'
        );
    }
);

$unlimitedId = seed_token(
    'unlimited',
    1,
    PERMISSION_DEVELOPER,
    null,
    false,
    false
);

test(
    'unlimited token remains unlimited until expiration',
    function () use ($unlimitedId): void {
        $first = consume_access_token(
            'unlimited',
            [PERMISSION_DEVELOPER],
            ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
        );
        $second = consume_access_token(
            'unlimited',
            [PERMISSION_DEVELOPER],
            ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
        );

        expect(
            $first['uses_remaining'] === null &&
            $second['uses_remaining'] === null &&
            token_row($unlimitedId)['uses_remaining'] === null
        );
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
    'delete on deplete removes one-use token',
    function () use ($deleteId): void {
        $authorization = consume_access_token(
            'delete-last',
            [PERMISSION_DEVELOPER],
            ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
        );

        expect(
            $authorization['single_use'] === true &&
            token_row($deleteId) === null
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
            fn() => consume_access_token(
                'needs-login',
                [PERMISSION_DEVELOPER],
                ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
            ),
            401,
            'authentication_required'
        );

        expect((int) token_row($authId)['uses_remaining'] === 1);
    }
);

test(
    'requires authentication permits signed-in recipient',
    function () use ($authId): void {
        $_SESSION['user_id'] = 2;

        consume_access_token(
            'needs-login',
            [PERMISSION_DEVELOPER],
            ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
        );

        expect((int) token_row($authId)['uses_remaining'] === 0);
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
    'owner cannot delegate a permission they do not hold',
    fn() => rejects(
        fn() => consume_access_token(
            'bad-escalation',
            [PERMISSION_DEVELOPER],
            ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
        ),
        403,
        'revoked_access_token'
    )
);

$combinedId = seed_token(
    'combined',
    1,
    PERMISSION_DEVELOPER | PERMISSION_GRANT_TOKEN_ACCESS,
    null,
    false,
    false
);

test(
    'combined permissions authorize more than one guarded scope',
    function () use ($combinedId): void {
        $speech = consume_access_token(
            'combined',
            [PERMISSION_DEVELOPER],
            ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
        );
        $tokens = consume_access_token(
            'combined',
            [PERMISSION_GRANT_TOKEN_ACCESS],
            ACCESS_TOKEN_SCOPE_ACCESS_TOKENS
        );

        expect(
            $speech['uses_remaining'] === null &&
            $tokens['uses_remaining'] === null &&
            token_row($combinedId) !== null
        );
    }
);

$newUserCombinedId = seed_token(
    'new-user-combined',
    1,
    PERMISSION_DEVELOPER | PERMISSION_GRANT_TOKEN_ACCESS,
    null,
    false,
    false,
    true
);

test(
    'New User token carries combined initial permissions but stays signup-only',
    function () use ($newUserCombinedId): void {
        $newUser = consume_access_token(
            'new-user-combined',
            [],
            ACCESS_TOKEN_SCOPE_NEW_USER
        );

        expect(
            $newUser['new_user'] === true &&
            $newUser['permissions'] ===
                (PERMISSION_DEVELOPER | PERMISSION_GRANT_TOKEN_ACCESS) &&
            token_row($newUserCombinedId) !== null
        );

        rejects(
            fn() => consume_access_token(
                'new-user-combined',
                [PERMISSION_GRANT_TOKEN_ACCESS],
                ACCESS_TOKEN_SCOPE_ACCESS_TOKENS
            ),
            403,
            'token_scope_denied'
        );
    }
);

seed_token(
    'unauthorized-new-user',
    3,
    PERMISSION_GRANT_TOKEN_ACCESS,
    1,
    false,
    false,
    true
);

test(
    'New User capability requires owner to retain Create Users',
    fn() => rejects(
        fn() => consume_access_token(
            'unauthorized-new-user',
            [],
            ACCESS_TOKEN_SCOPE_NEW_USER
        ),
        403,
        'revoked_access_token'
    )
);

$systemId = seed_token(
    'system-token',
    null,
    PERMISSION_GRANT_TOKEN_ACCESS,
    null,
    false,
    false
);

test(
    'ownerless system token can authorize delegated access',
    function () use ($systemId): void {
        $_SESSION = [];

        $authorization = consume_access_token(
            'system-token',
            [PERMISSION_GRANT_TOKEN_ACCESS],
            ACCESS_TOKEN_SCOPE_ACCESS_TOKENS,
            true
        );

        $grant = access_token_session_grant(
            ACCESS_TOKEN_SCOPE_ACCESS_TOKENS
        );

        expect(
            $authorization['owner_user_id'] === null &&
            $grant['owner_user_id'] === null &&
            $grant['permissions'] === PERMISSION_GRANT_TOKEN_ACCESS &&
            token_row($systemId) !== null
        );
    }
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
    fn() => rejects(
        fn() => consume_access_token(
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
    false,
    time() - 1
);

test(
    'expired token is rejected without consumption',
    fn() => rejects(
        fn() => consume_access_token(
            'expired',
            [PERMISSION_DEVELOPER],
            ACCESS_TOKEN_SCOPE_SPEECH_EDITOR
        ),
        401,
        'expired_access_token'
    )
);

echo $passed . " tests passed." . PHP_EOL;
