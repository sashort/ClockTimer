<?php
declare(strict_types=1);

class ApiFailure extends RuntimeException
{
    public function __construct(public int $status, public string $apiCode)
    {
        parent::__construct($apiCode);
    }
}

function api_error(string $message, int $status = 400, string $code = 'bad_request'): never
{
    throw new ApiFailure($status, $code);
}

function current_user(): array
{
    return $GLOBALS['currentUser'];
}

require_once __DIR__ . '/../api/_core/permissions.php';

function expect_lookup(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$ordinary = ['id' => 1, 'permissions' => 0];
$lookup = ['id' => 2, 'permissions' => PERMISSION_LOOKUP_USERS];
$super = ['id' => 3, 'permissions' => PERMISSION_SUPERUSER];

expect_lookup(
    PERMISSION_LOOKUP_USERS === 128,
    'lookup_users should use bit 128'
);
expect_lookup(
    PERMISSION_ALL === 255,
    'all permissions should include lookup_users'
);
expect_lookup(
    has_permission($lookup, PERMISSION_LOOKUP_USERS),
    'lookup_users should authorize lookup'
);
expect_lookup(
    !has_permission($ordinary, PERMISSION_LOOKUP_USERS),
    'ordinary users should not lookup users'
);
expect_lookup(
    has_permission($super, PERMISSION_LOOKUP_USERS),
    'superuser should imply lookup_users'
);

$GLOBALS['currentUser'] = $ordinary;

try {
    require_permission(PERMISSION_LOOKUP_USERS);
    throw new RuntimeException('lookup permission should be required');
} catch (ApiFailure $error) {
    expect_lookup(
        $error->status === 403 &&
        $error->apiCode === 'permission_required',
        'lookup permission rejection should be permission_required'
    );
}

$GLOBALS['currentUser'] = $lookup;
expect_lookup(
    require_permission(PERMISSION_LOOKUP_USERS)['id'] === 2,
    'lookup permission should pass'
);

$endpoint = file_get_contents(__DIR__ . '/../api/admin/user-lookup/index.php');
expect_lookup(
    is_string($endpoint) && $endpoint !== '',
    'user lookup endpoint should exist'
);

foreach (
    [
        'require_permission(PERMISSION_LOOKUP_USERS)',
        'At least one user lookup criterion is required.',
        "id = :id",
        'LEFT(username, CHAR_LENGTH(:username_length)) = :username_value',
        'LOCATE(:first_name, first_name) > 0',
        'LOCATE(:last_name, last_name) > 0',
        'LOCATE(:preferred_name, preferred_name) > 0',
        "'type' => 'user'",
        "'version' => 1",
        "'userId' => (int) \$row['id']",
        "'hasMore' => \$hasMore",
    ] as $needle
) {
    expect_lookup(
        str_contains($endpoint, $needle),
        'user lookup endpoint should contain: ' . $needle
    );
}

expect_lookup(
    !str_contains($endpoint, "'permissions' =>"),
    'identity results must not contain permissions'
);

echo "PASS lookup_users permission and identity-only search API" . PHP_EOL;
