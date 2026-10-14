<?php
declare(strict_types=1);

const ACCESS_TOKEN_SCOPE_SQL = 'sql';
const ACCESS_TOKEN_SCOPE_SPEECH_EDITOR = 'speech_editor';
const ACCESS_TOKEN_SCOPE_ACCESS_TOKENS = 'access_tokens';
const ACCESS_TOKEN_SCOPE_NEW_USER = 'new_user';

function optional_current_user(): ?array
{
    $value = $_SESSION['user_id'] ?? null;

    if (!is_int($value) && !(is_string($value) && ctype_digit($value))) {
        return null;
    }

    $id = (int) $value;

    if ($id < 1) {
        return null;
    }

    $statement = db()->prepare(
        'SELECT id, first_name, last_name, preferred_name, username, permissions '
        . 'FROM users WHERE id = :id LIMIT 1'
    );
    $statement->execute([':id' => $id]);
    $user = $statement->fetch();

    if (!$user) {
        return null;
    }

    $user['id'] = (int) $user['id'];
    $user['permissions'] = (int) $user['permissions'];

    return $user;
}

function permission_mask_allows(int $mask, int $permission): bool
{
    return
        ($mask & PERMISSION_SUPERUSER) !== 0 ||
        ($mask & $permission) === $permission;
}

function permission_mask_allows_any(int $mask, int ...$permissions): bool
{
    foreach ($permissions as $permission) {
        if (permission_mask_allows($mask, $permission)) {
            return true;
        }
    }

    return false;
}

function access_token_bearer(): ?string
{
    $authorization =
        $_SERVER['HTTP_AUTHORIZATION'] ??
        $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ??
        '';

    if (!is_string($authorization) || $authorization === '') {
        return null;
    }

    if (!preg_match('/^Bearer\s+(.+)$/iD', trim($authorization), $matches)) {
        return null;
    }

    $token = trim($matches[1]);

    return $token === '' ? null : $token;
}

function access_token_form_value(): ?string
{
    $value = $_POST['access_token'] ?? null;

    if (!is_string($value)) {
        return null;
    }

    $value = trim($value);

    return $value === '' ? null : $value;
}

function access_token_query_value(): ?string
{
    if (!array_key_exists('access_token', $_GET)) {
        return null;
    }

    $value = $_GET['access_token'];

    if (!is_string($value)) {
        api_error(
            'The access token is invalid.',
            401,
            'invalid_access_token'
        );
    }

    $value = trim($value);

    if ($value === '') {
        api_error(
            'The access token is invalid.',
            401,
            'invalid_access_token'
        );
    }

    return $value;
}

function access_token_hash(string $token): string
{
    return hash('sha256', $token);
}

function access_token_generate(): string
{
    return 'wmof_' . rtrim(
        strtr(
            base64_encode(random_bytes(32)),
            '+/',
            '-_'
        ),
        '='
    );
}

function access_token_session_grant(string $scope): ?array
{
    $grants = $_SESSION['access_token_grants'] ?? null;

    if (!is_array($grants) || !is_array($grants[$scope] ?? null)) {
        return null;
    }

    $grant = $grants[$scope];
    $expiresAt = (int) ($grant['expires_at'] ?? 0);

    if ($expiresAt <= time()) {
        unset($_SESSION['access_token_grants'][$scope]);
        return null;
    }

    if (!empty($grant['requires_authentication'])) {
        $user =
            optional_current_user();

        if (
            $user === null ||
            (int) ($grant['authenticated_user_id'] ?? 0) !==
                (int) $user['id']
        ) {
            unset(
                $_SESSION[
                    'access_token_grants'
                ][
                    $scope
                ]
            );

            return null;
        }
    }

    return $grant;
}

function access_token_store_session_grant(string $scope, array $authorization): void
{
    if (!isset($_SESSION['access_token_grants']) || !is_array($_SESSION['access_token_grants'])) {
        $_SESSION['access_token_grants'] = [];
    }

    $_SESSION['access_token_grants'][$scope] = [
        'token_id' => (int) $authorization['token_id'],
        'owner_user_id' => $authorization['owner_user_id'] === null
            ? null
            : (int) $authorization['owner_user_id'],
        'permissions' => (int) $authorization['permissions'],
        'new_user' => (bool) ($authorization['new_user'] ?? false),
        'expires_at' => (int) $authorization['expires_at'],
        'requires_authentication' => (bool) $authorization['requires_authentication'],
        'authenticated_user_id' => isset($authorization['user']['id'])
            ? (int) $authorization['user']['id']
            : null,
        'principal_key' => 'token-' . (int) $authorization['token_id'],
    ];
}

function consume_access_token(
    string $rawToken,
    array $requiredPermissions,
    string $scope,
    bool $establishSessionGrant = false,
    ?string $mode = null
): array {
    if (
        !in_array(
            $scope,
            [
                ACCESS_TOKEN_SCOPE_SQL,
                ACCESS_TOKEN_SCOPE_SPEECH_EDITOR,
                ACCESS_TOKEN_SCOPE_ACCESS_TOKENS,
                ACCESS_TOKEN_SCOPE_NEW_USER,
            ],
            true
        )
    ) {
        api_error('This token cannot be used for that resource.', 403, 'token_scope_denied');
    }

    if ($rawToken === '' || strlen($rawToken) > 512) {
        api_error('The access token is invalid.', 401, 'invalid_access_token');
    }

    $pdo = db();
    $user = optional_current_user();

    try {
        $pdo->beginTransaction();

        $statement = $pdo->prepare(
            'SELECT t.id, t.owner_user_id, t.name, t.permissions, t.new_user, '
            . 't.uses_remaining, t.delete_on_deplete, t.requires_authentication, '
            . 't.expires_at, u.permissions AS owner_permissions '
            . 'FROM access_tokens t '
            . 'LEFT JOIN users u ON u.id = t.owner_user_id '
            . 'WHERE t.token_hash = :token_hash LIMIT 1 FOR UPDATE'
        );
        $statement->execute([
            ':token_hash' => access_token_hash($rawToken),
        ]);
        $row = $statement->fetch();

        if (!$row) {
            $pdo->rollBack();
            api_error('The access token is invalid.', 401, 'invalid_access_token');
        }

        $tokenPermissions = (int) $row['permissions'];
        $isNewUserToken = (bool) $row['new_user'];
        $ownerUserId =
            $row['owner_user_id'] === null
                ? null
                : (int) $row['owner_user_id'];
        $ownerPermissions =
            $row['owner_permissions'] === null
                ? null
                : (int) $row['owner_permissions'];
        $expiresAt = (int) $row['expires_at'];
        $usesRemaining =
            $row['uses_remaining'] === null
                ? null
                : (int) $row['uses_remaining'];
        $requiresAuthentication = (bool) $row['requires_authentication'];

        if ($expiresAt <= time()) {
            $pdo->rollBack();
            api_error('The access token has expired.', 401, 'expired_access_token');
        }

        if ($usesRemaining !== null && $usesRemaining <= 0) {
            $pdo->rollBack();
            api_error('The access token has no uses remaining.', 401, 'depleted_access_token');
        }

        if ($ownerUserId !== null) {
            if ($ownerPermissions === null) {
                $pdo->rollBack();
                api_error('The access token owner no longer exists.', 403, 'revoked_access_token');
            }

            $ownerCanIssue =
                $isNewUserToken
                    ? permission_mask_allows(
                        $ownerPermissions,
                        PERMISSION_CREATE_USERS
                    )
                    : permission_mask_allows(
                        $ownerPermissions,
                        PERMISSION_GRANT_TOKEN_ACCESS
                    );

            $ownerCanGrantMask =
                $tokenPermissions === 0 ||
                permission_mask_allows(
                    $ownerPermissions,
                    $tokenPermissions
                );

            if (!$ownerCanIssue || !$ownerCanGrantMask) {
                $pdo->rollBack();
                api_error('The access token grant is no longer authorized by its owner.', 403, 'revoked_access_token');
            }
        }

        if ($scope === ACCESS_TOKEN_SCOPE_NEW_USER) {
            if (!$isNewUserToken) {
                $pdo->rollBack();
                api_error('This token cannot create a new user.', 403, 'token_scope_denied');
            }
        } else {
            if ($isNewUserToken) {
                $pdo->rollBack();
                api_error(
                    'A New User token can only be used to create a new account.',
                    403,
                    'token_scope_denied'
                );
            }

            if (
                $requiredPermissions !== [] &&
                !permission_mask_allows_any(
                    $tokenPermissions,
                    ...$requiredPermissions
                )
            ) {
                $pdo->rollBack();
                api_error('The access token does not grant the required permission.', 403, 'permission_required');
            }
        }

        if ($requiresAuthentication && $user === null) {
            $pdo->rollBack();
            api_error('This access token requires an authenticated WMOF session.', 401, 'authentication_required');
        }

        $nextCount =
            $usesRemaining === null
                ? null
                : max(0, $usesRemaining - 1);

        if (
            $nextCount !== null &&
            $nextCount === 0 &&
            (bool) $row['delete_on_deplete']
        ) {
            $delete = $pdo->prepare(
                'DELETE FROM access_tokens WHERE id = :id'
            );
            $delete->execute([
                ':id' => (int) $row['id'],
            ]);
        } else {
            $update = $pdo->prepare(
                'UPDATE access_tokens '
                . 'SET uses_remaining = :uses_remaining, last_used_at = :last_used_at '
                . 'WHERE id = :id'
            );
            $update->execute([
                ':uses_remaining' => $nextCount,
                ':last_used_at' => time(),
                ':id' => (int) $row['id'],
            ]);
        }

        $pdo->commit();

        $authorization = [
            'mode' =>
                $mode ??
                (
                    $establishSessionGrant
                        ? 'token_form'
                        : 'token_bearer'
                ),
            'scope' => $scope,
            'token_id' => (int) $row['id'],
            'token_name' => (string) $row['name'],
            'owner_user_id' => $ownerUserId,
            'permissions' => $tokenPermissions,
            'new_user' => $isNewUserToken,
            'expires_at' => $expiresAt,
            'requires_authentication' => $requiresAuthentication,
            'uses_remaining' => $nextCount,
            'single_use' => $usesRemaining === 1,
            'user' => $user,
            'principal_key' => 'token-' . (int) $row['id'],
        ];

        if ($establishSessionGrant) {
            access_token_store_session_grant($scope, $authorization);
        }

        return $authorization;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $error;
    }
}

function existing_guarded_access(
    array $requiredPermissions,
    string $scope,
    bool $allowQueryToken = true
): ?array {
    if ($allowQueryToken) {
        $queryToken =
            access_token_query_value();

        if ($queryToken !== null) {
            return consume_access_token(
                $queryToken,
                $requiredPermissions,
                $scope,
                true,
                'token_query'
            );
        }
    }

    $user = optional_current_user();

    if ($user !== null && has_any_permission($user, ...$requiredPermissions)) {
        return [
            'mode' => 'session',
            'scope' => $scope,
            'permissions' => (int) $user['permissions'],
            'user' => $user,
            'owner_user_id' => (int) $user['id'],
            'principal_key' => 'user-' . (int) $user['id'],
        ];
    }

    $grant = access_token_session_grant($scope);

    if (
        $grant !== null &&
        permission_mask_allows_any(
            (int) $grant['permissions'],
            ...$requiredPermissions
        )
    ) {
        return [
            'mode' => 'token_session',
            'scope' => $scope,
            'token_id' => (int) $grant['token_id'],
            'owner_user_id' => $grant['owner_user_id'] === null
                ? null
                : (int) $grant['owner_user_id'],
            'permissions' => (int) $grant['permissions'],
            'new_user' => (bool) ($grant['new_user'] ?? false),
            'expires_at' => (int) $grant['expires_at'],
            'requires_authentication' => (bool) $grant['requires_authentication'],
            'user' => $user,
            'principal_key' => (string) $grant['principal_key'],
        ];
    }

    return null;
}

function authorize_guarded_access(
    array $requiredPermissions,
    string $scope,
    bool $allowFormToken = false
): array {
    $queryToken =
        access_token_query_value();

    if ($queryToken !== null) {
        return consume_access_token(
            $queryToken,
            $requiredPermissions,
            $scope,
            true,
            'token_query'
        );
    }

    $bearer = access_token_bearer();

    if ($bearer !== null) {
        return consume_access_token(
            $bearer,
            $requiredPermissions,
            $scope,
            false
        );
    }

    if ($allowFormToken) {
        $formToken = access_token_form_value();

        if ($formToken !== null) {
            return consume_access_token(
                $formToken,
                $requiredPermissions,
                $scope,
                true
            );
        }
    }

    $existing = existing_guarded_access(
        $requiredPermissions,
        $scope,
        false
    );

    if ($existing !== null) {
        return $existing;
    }

    if (optional_current_user() === null) {
        api_error('Authentication or a valid access token is required.', 401, 'unauthorized');
    }

    api_error('This operation requires an administrative permission.', 403, 'permission_required');
}

function render_access_token_prompt(
    string $title,
    string $description,
    string $action
): never {
    $nonce = base64_encode(random_bytes(18));

    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store, private');
    header('Referrer-Policy: no-referrer');
    header('X-Content-Type-Options: nosniff');
    header(
        "Content-Security-Policy: default-src 'none'; "
        . "style-src 'nonce-$nonce'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
    );
    ?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?=htmlspecialchars($title, ENT_QUOTES, 'UTF-8')?></title>
<style nonce="<?=htmlspecialchars($nonce, ENT_QUOTES, 'UTF-8')?>">
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#081d40;color:#fff;font:15px/1.5 system-ui,sans-serif}
main{width:min(560px,100%);padding:24px;background:#0d2d58;border:1px solid #789fbe;border-radius:12px}
h1{margin:0 0 8px;font-size:24px}p{color:#bcd7e9}
label{display:grid;gap:6px;margin-top:18px;font-weight:700}
input{width:100%;padding:11px;color:#fff;background:#173a61;border:1px solid #91b6d5;border-radius:7px;font:13px ui-monospace,monospace}
button{margin-top:16px;padding:10px 16px;color:#fff;background:#0053e2;border:1px solid #4285ee;border-radius:7px;font:inherit;font-weight:800;cursor:pointer}
</style>
</head>
<body>
<main>
<h1><?=htmlspecialchars($title, ENT_QUOTES, 'UTF-8')?></h1>
<p><?=htmlspecialchars($description, ENT_QUOTES, 'UTF-8')?></p>
<form method="post" action="<?=htmlspecialchars($action, ENT_QUOTES, 'UTF-8')?>">
<label>
<span>Access token</span>
<input name="access_token" type="password" autocomplete="off" spellcheck="false" required autofocus>
</label>
<button type="submit">Continue</button>
</form>
</main>
</body>
</html>
<?php
    exit;
}

function guarded_access_has_permission(array $authorization, int $permission): bool
{
    return permission_mask_allows(
        (int) ($authorization['permissions'] ?? 0),
        $permission
    );
}

function guarded_access_requires_csrf(array $authorization): bool
{
    return !in_array(
        $authorization['mode'] ?? '',
        ['token_bearer', 'token_query', 'token_form'],
        true
    );
}

function guarded_access_audit_user_id(array $authorization): int
{
    if (isset($authorization['user']['id'])) {
        return (int) $authorization['user']['id'];
    }

    return (int) ($authorization['owner_user_id'] ?? 0);
}

function guarded_access_principal_key(array $authorization): string
{
    return (string) ($authorization['principal_key'] ?? 'unknown');
}

function guarded_access_is_token(array $authorization): bool
{
    return str_starts_with((string) ($authorization['mode'] ?? ''), 'token_');
}
