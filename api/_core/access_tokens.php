<?php
declare(strict_types=1);

const ACCESS_TOKEN_SCOPE_SQL = 'sql';
const ACCESS_TOKEN_SCOPE_SPEECH_EDITOR = 'speech_editor';

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
    $authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

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

    if (
        !empty($grant['requires_authentication']) &&
        optional_current_user() === null
    ) {
        unset($_SESSION['access_token_grants'][$scope]);
        return null;
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
        'owner_user_id' => (int) $authorization['owner_user_id'],
        'permissions' => (int) $authorization['permissions'],
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
    bool $establishSessionGrant = false
): array {
    if (!in_array($scope, [ACCESS_TOKEN_SCOPE_SQL, ACCESS_TOKEN_SCOPE_SPEECH_EDITOR], true)) {
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
            'SELECT t.id, t.owner_user_id, t.name, t.permissions, t.uses_remaining, '
            . 't.delete_on_deplete, t.requires_authentication, t.expires_at, '
            . 'u.permissions AS owner_permissions '
            . 'FROM access_tokens t '
            . 'INNER JOIN users u ON u.id = t.owner_user_id '
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
        $ownerPermissions = (int) $row['owner_permissions'];
        $expiresAt = (int) $row['expires_at'];
        $usesRemaining = (int) $row['uses_remaining'];
        $requiresAuthentication = (bool) $row['requires_authentication'];

        if ($expiresAt <= time()) {
            $pdo->rollBack();
            api_error('The access token has expired.', 401, 'expired_access_token');
        }

        if ($usesRemaining <= 0) {
            $pdo->rollBack();
            api_error('The access token has no uses remaining.', 401, 'depleted_access_token');
        }

        if (
            !permission_mask_allows($ownerPermissions, PERMISSION_GRANT_TOKEN_ACCESS) ||
            !permission_mask_allows_any($ownerPermissions, $tokenPermissions)
        ) {
            $pdo->rollBack();
            api_error('The access token grant is no longer authorized by its owner.', 403, 'revoked_access_token');
        }

        if (!permission_mask_allows_any($tokenPermissions, ...$requiredPermissions)) {
            $pdo->rollBack();
            api_error('The access token does not grant the required permission.', 403, 'permission_required');
        }

        if ($requiresAuthentication && $user === null) {
            $pdo->rollBack();
            api_error('This access token requires an authenticated WMOF session.', 401, 'authentication_required');
        }

        $nextCount = max(0, $usesRemaining - 1);

        if ($nextCount === 0 && (bool) $row['delete_on_deplete']) {
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
            'mode' => $establishSessionGrant ? 'token_form' : 'token_bearer',
            'scope' => $scope,
            'token_id' => (int) $row['id'],
            'token_name' => (string) $row['name'],
            'owner_user_id' => (int) $row['owner_user_id'],
            'permissions' => $tokenPermissions,
            'expires_at' => $expiresAt,
            'requires_authentication' => $requiresAuthentication,
            'uses_remaining' => $nextCount,
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

function authorize_guarded_access(
    array $requiredPermissions,
    string $scope,
    bool $allowFormToken = false
): array {
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
            'owner_user_id' => (int) $grant['owner_user_id'],
            'permissions' => (int) $grant['permissions'],
            'expires_at' => (int) $grant['expires_at'],
            'requires_authentication' => (bool) $grant['requires_authentication'],
            'user' => $user,
            'principal_key' => (string) $grant['principal_key'],
        ];
    }

    if ($user === null) {
        api_error('Authentication or a valid access token is required.', 401, 'unauthorized');
    }

    api_error('This operation requires an administrative permission.', 403, 'permission_required');
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
        ['token_bearer', 'token_form'],
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
