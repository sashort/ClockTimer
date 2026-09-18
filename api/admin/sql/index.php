<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/_core/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && ($_GET['console'] ?? null) === '1') {
    if (empty($_SERVER['HTTPS']) || strtolower((string) $_SERVER['HTTPS']) === 'off') {
        api_error('HTTPS is required.', 403, 'https_required');
    }
    require_permission(PERMISSION_SUPERUSER);
    render_sql_console(csrf_token());
}
require_method('POST');
if (empty($_SERVER['HTTPS']) || strtolower((string) $_SERVER['HTTPS']) === 'off') {
    api_error('HTTPS is required.', 403, 'https_required');
}
$actor = require_permission(PERMISSION_SUPERUSER);
require_csrf();
$input = json_input();
$action = $input['action'] ?? 'execute';
if (!in_array($action, ['execute', 'migrations', 'migrate'], true)) {
    api_error('Unknown SQL administration action.', 422, 'invalid_action');
}
if ($action === 'execute' && (api_config()['admin_sql_enabled'] ?? false) !== true) {
    api_error('SQL access is disabled in server configuration.', 403, 'sql_disabled');
}
if ($action !== 'execute' && (api_config()['admin_migrations_enabled'] ?? false) !== true) {
    api_error('Migration access is disabled in server configuration.', 403, 'migrations_disabled');
}
$password = $input['password'] ?? null;
if (!is_string($password)) api_error('Password confirmation is required.', 422, 'invalid_argument');
$pdo = db();
$credential = $pdo->prepare('SELECT password_hash FROM users WHERE id = :id');
$credential->execute([':id' => $actor['id']]);
if (!password_verify($password, (string) $credential->fetchColumn())) {
    api_error('Password confirmation failed.', 401, 'invalid_credentials');
}
if ($action !== 'execute') {
    try {
        $result = $action === 'migrations'
            ? migration_status($pdo)
            : apply_migration($pdo, require_string($input, 'migration'), $actor['id']);
    } catch (MigrationFailure $error) {
        api_error($error->getMessage(), $error->status, $error->apiCode);
    }
    json_response($result);
}
$sql = require_string($input, 'sql');
if (strlen($sql) > 65536) api_error('SQL exceeds the 64 KiB limit.', 422, 'invalid_argument');

// MYSQL_ATTR_MULTI_STATEMENTS is disabled on this connection. MySQL parses
// the statement; splitting on semicolons would mishandle strings and comments.
// DDL can implicitly commit, so this endpoint does not promise rollback.
$changeId = uuid_v4();
$context = $pdo->prepare('SET @audit_user_id = :user_id, @audit_change_id = :change_id, @audit_sequence = 0, @audit_reversal_of = NULL');
$context->execute([':user_id' => $actor['id'], ':change_id' => $changeId]);
error_log(json_encode(['operation' => 'admin_sql', 'userId' => $actor['id'], 'changeId' => $changeId, 'sqlSha256' => hash('sha256', $sql)], JSON_THROW_ON_ERROR));
try {
    $statement = $pdo->query($sql);
    $rows = [];
    $truncated = false;
    if ($statement->columnCount() > 0) {
        while (($row = $statement->fetch()) !== false) {
            if (count($rows) === 1000) {
                $truncated = true;
                break;
            }
            $rows[] = $row;
        }
    }
    $affectedRows = $statement->rowCount();
    $statement->closeCursor();
    // Explicit transaction statements must not leave an open transaction.
    if ($pdo->inTransaction()) $pdo->rollBack();
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
    clear_audit_context($pdo);
}
json_response(['rows' => $rows, 'affectedRows' => $affectedRows, 'truncated' => $truncated, 'changeId' => $changeId]);
