<?php
declare(strict_types=1);

const PERMISSION_CREATE_USERS = 1;
const PERMISSION_MODIFY_USERS = 2;
const PERMISSION_SUPERUSER = 4;
const PERMISSION_DEVELOPER_PREVIEW = 8;
const PERMISSION_DEVELOPER = 16;
const PERMISSION_GRANT_TOKEN_ACCESS = 32;
const PERMISSION_ALL = 63;

function has_permission(array $user, int $permission): bool
{
    $mask = (int) $user['permissions'];
    return ($mask & PERMISSION_SUPERUSER) !== 0 || ($mask & $permission) === $permission;
}

function has_any_permission(array $user, int ...$permissions): bool
{
    foreach ($permissions as $permission) {
        if (has_permission($user, $permission)) {
            return true;
        }
    }
    return false;
}

function require_permission(int $permission): array
{
    // Read from the database on every request so revocations take effect immediately.
    $user = current_user();
    if (!has_permission($user, $permission)) {
        api_error('This operation requires an administrative permission.', 403, 'permission_required');
    }
    return $user;
}

function require_any_permission(int ...$permissions): array
{
    $user = current_user();
    if (!has_any_permission($user, ...$permissions)) {
        api_error('This operation requires a developer permission.', 403, 'permission_required');
    }
    return $user;
}

function require_user_edit_access(array $actor, array $target): void
{
    if ($actor['id'] === $target['id']) return;
    if (!has_permission($actor, PERMISSION_MODIFY_USERS) ||
        (has_permission($target, PERMISSION_SUPERUSER) && !has_permission($actor, PERMISSION_SUPERUSER))) {
        api_error('This operation requires an administrative permission.', 403, 'permission_required');
    }
}

function require_permission_assignment(array $actor, mixed $value): int
{
    if (!has_permission($actor, PERMISSION_SUPERUSER)) {
        api_error('Only a superuser can assign permissions.', 403, 'permission_required');
    }
    if (!is_int($value) || $value < 0 || ($value & ~PERMISSION_ALL) !== 0) {
        api_error('permissions must be an integer bitmask between 0 and 63.', 422, 'invalid_argument');
    }
    return $value;
}
