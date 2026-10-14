<?php
declare(strict_types=1);

const NEW_USER_TOKEN_TTL = 3600;

function create_new_user_token(
    PDO $pdo,
    ?int $ownerUserId,
    int $permissions = 0,
    bool $multiUse = false,
    ?int $now = null
): string {
    $now ??= time();

    if ($permissions < 0 || ($permissions & ~PERMISSION_ALL) !== 0) {
        api_error('The requested initial permissions are invalid.', 422, 'invalid_argument');
    }

    $token = access_token_generate();
    $hint = substr($token, 0, 10) . '…' . substr($token, -4);
    $statement = $pdo->prepare(
        'INSERT INTO access_tokens '
        . '(owner_user_id, name, token_hash, token_hint, permissions, new_user, '
        . 'uses_remaining, delete_on_deplete, requires_authentication, '
        . 'expires_at, created_at, updated_at) '
        . 'VALUES (:owner_user_id, :name, :token_hash, :token_hint, :permissions, 1, '
        . ':uses_remaining, :delete_on_deplete, 0, :expires_at, :created_at, :updated_at)'
    );
    $statement->execute([
        ':owner_user_id' => $ownerUserId,
        ':name' => 'New user invitation',
        ':token_hash' => access_token_hash($token),
        ':token_hint' => $hint,
        ':permissions' => $permissions,
        ':uses_remaining' => $multiUse ? null : 1,
        ':delete_on_deplete' => $multiUse ? 0 : 1,
        ':expires_at' => $now + NEW_USER_TOKEN_TTL,
        ':created_at' => $now,
        ':updated_at' => $now,
    ]);

    return $token;
}

function replace_new_user_token(
    PDO $pdo,
    ?int $ownerUserId,
    string $previousToken,
    int $permissions,
    bool $multiUse,
    ?int $now = null
): string {
    $previousToken = trim($previousToken);

    if ($previousToken !== '') {
        $sql =
            'DELETE FROM access_tokens '
            . 'WHERE token_hash = :token_hash AND new_user = 1 ';

        if ($ownerUserId === null) {
            $sql .= 'AND owner_user_id IS NULL';
            $params = [
                ':token_hash' => access_token_hash($previousToken),
            ];
        } else {
            $sql .= 'AND owner_user_id = :owner_user_id';
            $params = [
                ':token_hash' => access_token_hash($previousToken),
                ':owner_user_id' => $ownerUserId,
            ];
        }

        $pdo->prepare($sql)->execute($params);
    }

    return create_new_user_token(
        $pdo,
        $ownerUserId,
        $permissions,
        $multiUse,
        $now
    );
}

function create_invited_user(
    PDO $pdo,
    ?int $ownerUserId,
    int $permissions,
    array $input
): array {
    if ($permissions < 0 || ($permissions & ~PERMISSION_ALL) !== 0) {
        api_error('The invitation permissions are invalid.', 403, 'permission_required');
    }

    if ($ownerUserId !== null) {
        $actor = find_user_account($pdo, $ownerUserId);

        if (!has_permission($actor, PERMISSION_CREATE_USERS)) {
            api_error('This invitation is no longer authorized.', 403, 'permission_required');
        }

        if (
            $permissions !== 0 &&
            !permission_mask_allows((int) $actor['permissions'], $permissions)
        ) {
            api_error(
                'The invitation grants permissions its creator no longer has.',
                403,
                'permission_required'
            );
        }
    }

    $fields = account_fields($input, true);
    $fields['permissions'] = $permissions;
    $parameters = [];

    foreach ($fields as $column => $value) {
        $parameters[':' . $column] = $value;
    }

    $changeId = uuid_v4();
    $auditUserId = $ownerUserId ?? 0;

    try {
        $pdo->beginTransaction();
        $pdo->prepare(
            'SET @audit_user_id = :user, @audit_change_id = :change, '
            . '@audit_sequence = 0, @audit_reversal_of = NULL'
        )->execute([
            ':user' => $auditUserId,
            ':change' => $changeId,
        ]);

        $pdo->prepare(
            'INSERT INTO users (' . implode(', ', array_keys($fields)) . ') '
            . 'VALUES (' . implode(', ', array_keys($parameters)) . ')'
        )->execute($parameters);

        $id = (int) $pdo->lastInsertId();
        $pdo->commit();
        clear_audit_context($pdo);

        return find_user_account($pdo, $id);
    } catch (PDOException $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        clear_audit_context($pdo);

        if (($error->errorInfo[1] ?? null) === 1062) {
            api_error('That username is already in use.', 409, 'username_conflict');
        }

        throw $error;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        clear_audit_context($pdo);
        throw $error;
    }
}
