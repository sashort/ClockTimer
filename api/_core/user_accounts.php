<?php
declare(strict_types=1);

function find_user_account(PDO $pdo, int $userId, bool $lock = false): array
{
    $statement = $pdo->prepare(
        'SELECT id, first_name, last_name, preferred_name, username, permissions FROM users WHERE id = :id'
        . ($lock ? ' FOR UPDATE' : '')
    );
    $statement->execute([':id' => $userId]);
    $user = $statement->fetch();
    if (!$user) api_error('User was not found.', 404, 'user_not_found');
    $user['id'] = (int) $user['id'];
    $user['permissions'] = (int) $user['permissions'];
    return $user;
}

function account_fields(array $input, bool $creating): array
{
    $allowed = ['action', 'userId', 'firstName', 'lastName', 'preferredName', 'username', 'password', 'permissions'];
    foreach ($input as $key => $value) {
        if (!in_array($key, $allowed, true)) {
            api_error('Unknown account field.', 422, 'invalid_argument');
        }
    }
    $fields = [];
    foreach (['firstName' => 'first_name', 'lastName' => 'last_name', 'preferredName' => 'preferred_name', 'username' => 'username'] as $key => $column) {
        if (!array_key_exists($key, $input)) {
            if ($creating && $key !== 'preferredName') require_string($input, $key);
            continue;
        }
        if ($key === 'preferredName' && $input[$key] === null) {
            $fields[$column] = null;
            continue;
        }
        $text = require_string($input, $key, $key === 'preferredName');
        $length = preg_match_all('/./us', $text);
        if ($length === false || $length > ($key === 'username' ? 191 : 100)) {
            api_error($key . ' is too long or is invalid UTF-8.', 422, 'invalid_argument');
        }
        $fields[$column] = $text;
    }
    if ($creating || array_key_exists('password', $input)) {
        // Passwords are never trimmed: spaces are part of the credential.
        $password = $input['password'] ?? null;
        if (!is_string($password) || $password === '' || strlen($password) > 72) {
            api_error('password must contain between 1 and 72 bytes.', 422, 'invalid_argument');
        }
        $fields['password_hash'] = password_hash($password, PASSWORD_BCRYPT);
    }
    return $fields;
}

function save_user_account(PDO $pdo, array $input, bool $creating): array
{
    // Lock the actor together with the target to serialize privilege changes.
    $actor = find_user_account($pdo, authenticated_user_id(), true);
    if ($creating) {
        if (!has_permission($actor, PERMISSION_CREATE_USERS)) {
            api_error('Creating users requires an administrative permission.', 403, 'permission_required');
        }
        $userId = null;
    } else {
        $userId = isset($input['userId']) ? require_positive_int($input, 'userId') : $actor['id'];
        $target = find_user_account($pdo, $userId, true);
        require_user_edit_access($actor, $target);
    }
    $fields = account_fields($input, $creating);
    if (array_key_exists('permissions', $input)) {
        $fields['permissions'] = require_permission_assignment($actor, $input['permissions']);
    } elseif ($creating) {
        $fields['permissions'] = 0;
    }
    if ($fields === []) api_error('At least one account field is required.', 422, 'invalid_argument');
    $parameters = [];
    foreach ($fields as $column => $value) $parameters[':' . $column] = $value;
    if ($creating) {
        $sql = 'INSERT INTO users (' . implode(', ', array_keys($fields)) . ') VALUES (' . implode(', ', array_keys($parameters)) . ')';
    } else {
        $assignments = [];
        foreach ($fields as $column => $value) $assignments[] = $column . ' = :' . $column;
        $sql = 'UPDATE users SET ' . implode(', ', $assignments) . ' WHERE id = :id';
        $parameters[':id'] = $userId;
    }
    try {
        $pdo->prepare($sql)->execute($parameters);
    } catch (PDOException $error) {
        if (($error->errorInfo[1] ?? null) === 1062) {
            api_error('That username is already in use.', 409, 'username_conflict');
        }
        throw $error;
    }
    return find_user_account($pdo, $creating ? (int) $pdo->lastInsertId() : $userId);
}
