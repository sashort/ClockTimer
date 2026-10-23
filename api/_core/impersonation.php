<?php
declare(strict_types=1);

function impersonation_credential_token(mixed $credential): ?string
{
    if (!is_string($credential)) return null;
    $value = trim($credential);
    return str_starts_with($value, 'wmof_') ? $value : null;
}

function impersonation_record_start(PDO $pdo, array $target, array $authorization): array
{
    if (!permission_mask_allows((int)$authorization['permissions'], PERMISSION_IMPERSONATE)) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        api_error('Impersonate permission is required.', 403, 'permission_required');
    }
    // A delegated impersonation token cannot turn into a Superuser grant.
    if (has_permission($target, PERMISSION_SUPERUSER) &&
        !permission_mask_allows((int)$authorization['permissions'], PERMISSION_SUPERUSER)) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        api_error('Superuser permission is required for this target.', 403, 'permission_required');
    }
    if (isset($_SESSION['impersonation'])) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        api_error('End the active impersonation first.', 409, 'impersonation_active');
    }
    $token = guarded_access_is_token($authorization);
    $actorId = $token ? ($authorization['owner_user_id'] ?? null) : ($authorization['user']['id'] ?? null);
    $original = optional_current_user();
    // Only an actually authenticated operator can be returned to. A token
    // never creates a login for its owner or retains its owner's privileges.
    $returnId = $original && has_permission($original, PERMISSION_IMPERSONATE)
        ? (int)$original['id'] : null;
    $id = uuid_v4();
    $pdo->prepare('INSERT INTO impersonation_sessions (id, actor_user_id, target_user_id, token_id, authentication, started_at) VALUES (:id,:actor,:target,:token,:authentication,:now)')
        ->execute([':id'=>$id, ':actor'=>$actorId, ':target'=>(int)$target['id'],
            ':token'=>$token ? (int)$authorization['token_id'] : null,
            ':authentication'=>$token ? 'token' : 'session', ':now'=>time()]);
    return ['id'=>$id, 'actor_user_id'=>$actorId, 'target_user_id'=>(int)$target['id'], 'return_user_id'=>$returnId];
}

function impersonation_replace_session(int $userId, ?array $metadata = null): void
{
    if (!session_regenerate_id(true)) throw new RuntimeException('Unable to rotate login session.');
    // Do not copy access-token grants, source CSRF, or source privileges.
    $_SESSION = ['user_id'=>$userId, 'csrf_token'=>bin2hex(random_bytes(32))];
    if ($metadata !== null) $_SESSION['impersonation'] = $metadata;
}

function impersonation_end(PDO $pdo, string $reason): void
{
    $state = $_SESSION['impersonation'] ?? null;
    if (!is_array($state)) return;
    $pdo->prepare('UPDATE impersonation_sessions SET ended_at=:now,end_reason=:reason WHERE id=:id AND target_user_id=:target AND ended_at IS NULL')
        ->execute([':now'=>time(), ':reason'=>$reason, ':id'=>$state['id'], ':target'=>$state['target_user_id']]);
    unset($_SESSION['impersonation']);
}

function impersonation_return(PDO $pdo): array
{
    $state = $_SESSION['impersonation'] ?? null;
    $originalId = $state['return_user_id'] ?? null;
    if (!$originalId || (int)($_SESSION['user_id'] ?? 0) !== (int)($state['target_user_id'] ?? 0))
        api_error('A fresh operator login is required.', 409, 'operator_login_required');
    $original = find_user_account($pdo, (int)$originalId);
    if (!has_permission($original, PERMISSION_IMPERSONATE))
        api_error('The original account no longer has Impersonate permission.', 403, 'permission_required');
    $query = $pdo->prepare('SELECT id FROM impersonation_sessions WHERE id=:id AND target_user_id=:target AND ended_at IS NULL');
    $query->execute([':id'=>$state['id'], ':target'=>$state['target_user_id']]);
    if (!$query->fetch()) api_error('Impersonation is no longer active.', 409, 'impersonation_ended');
    impersonation_end($pdo, 'return');
    impersonation_replace_session((int)$original['id']);
    return $original;
}

function impersonation_token_login(string $token, array $input): array
{
    $target = null;
    $metadata = null;
    consume_access_token($token, [PERMISSION_IMPERSONATE], ACCESS_TOKEN_SCOPE_IMPERSONATION,
        false, 'token_login', static function(PDO $pdo, array $authorization) use ($input, &$target, &$metadata): void {
            $byPin = ($input['action'] ?? '') === 'connect-pin';
            if ($byPin) {
                require_once __DIR__.'/voice_login.php';
                $identity = four_digit_credential($input['loginId'] ?? null, 'loginId');
            } else $identity = require_string($input, 'username');
            $query = $pdo->prepare('SELECT id,first_name,last_name,preferred_name,username,permissions FROM users WHERE '.($byPin ? 'login_id' : 'username').'=:identity LIMIT 1 FOR UPDATE');
            $query->execute([':identity'=>$identity]);
            $target = $query->fetch();
            if (!$target) {
                $pdo->rollBack();
                api_error('The target account was not found.', 404, 'user_not_found');
            }
            $target['id'] = (int)$target['id'];
            $target['permissions'] = (int)$target['permissions'];
            $metadata = impersonation_record_start($pdo, $target, $authorization);
        });
    impersonation_replace_session((int)$target['id'], $metadata);
    return $target;
}
