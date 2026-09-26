<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/_core/bootstrap.php';

if (empty($_SERVER['HTTPS']) || strtolower((string) $_SERVER['HTTPS']) === 'off') {
    api_error('HTTPS is required.', 403, 'https_required');
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$consoleRequested = ($_GET['console'] ?? null) === '1';

if ($method === 'GET' && $consoleRequested) {
    $authorization = existing_guarded_access(
        [PERMISSION_SUPERUSER],
        ACCESS_TOKEN_SCOPE_SQL
    );

    if ($authorization === null) {
        render_access_token_prompt(
            'Superuser SQL console',
            'Sign in as a superuser or enter an access token that grants the Superuser permission.',
            '?console=1'
        );
    }

    render_sql_console(
        csrf_token(),
        ($authorization['mode'] ?? '') === 'session'
    );
}

if (
    $method === 'POST' &&
    $consoleRequested &&
    access_token_form_value() !== null
) {
    authorize_guarded_access(
        [PERMISSION_SUPERUSER],
        ACCESS_TOKEN_SCOPE_SQL,
        true
    );

    render_sql_console(
        csrf_token(),
        false
    );
}

require_method('POST');

$authorization = authorize_guarded_access(
    [PERMISSION_SUPERUSER],
    ACCESS_TOKEN_SCOPE_SQL
);

if (guarded_access_requires_csrf($authorization)) {
    require_csrf();
}

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

$pdo = db();
$actorId = guarded_access_audit_user_id($authorization);

if (($authorization['mode'] ?? '') === 'session') {
    $password = $input['password'] ?? null;

    if (!is_string($password)) {
        api_error('Password confirmation is required.', 422, 'invalid_argument');
    }

    $credential = $pdo->prepare(
        'SELECT password_hash FROM users WHERE id = :id'
    );
    $credential->execute([
        ':id' => $actorId,
    ]);

    if (!password_verify($password, (string) $credential->fetchColumn())) {
        api_error('Password confirmation failed.', 401, 'invalid_credentials');
    }
}

if ($action !== 'execute') {
    try {
        $result = $action === 'migrations'
            ? migration_status($pdo)
            : apply_migration(
                $pdo,
                require_string($input, 'migration'),
                $actorId
            );
    } catch (MigrationFailure $error) {
        api_error(
            $error->getMessage(),
            $error->status,
            $error->apiCode
        );
    }

    json_response($result);
}

$sql = require_string($input, 'sql');

if (strlen($sql) > 65536) {
    api_error('SQL exceeds the 64 KiB limit.', 422, 'invalid_argument');
}

try {
    $statements = split_sql_statements($sql);
} catch (InvalidArgumentException $error) {
    api_error($error->getMessage(), 422, 'invalid_argument');
}

if ($statements === []) {
    api_error('SQL must contain at least one executable statement.', 422, 'invalid_argument');
}

if (count($statements) > 100) {
    api_error('A SQL batch is limited to 100 statements.', 422, 'invalid_argument');
}

$changeId = uuid_v4();
$context = $pdo->prepare(
    'SET @audit_user_id = :user_id, @audit_change_id = :change_id, '
    . '@audit_sequence = 0, @audit_reversal_of = NULL'
);
$context->execute([
    ':user_id' => $actorId,
    ':change_id' => $changeId,
]);

error_log(json_encode([
    'operation' => 'admin_sql',
    'userId' => $actorId,
    'principal' => guarded_access_principal_key($authorization),
    'changeId' => $changeId,
    'statementCount' => count($statements),
    'sqlSha256' => hash('sha256', $sql),
], JSON_THROW_ON_ERROR));

$results = [];
$failure = null;

try {
    foreach ($statements as $index => $sqlStatement) {
        try {
            $statement = $pdo->query($sqlStatement);
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

            $results[] = [
                'statementIndex' => $index + 1,
                'statementSha256' => hash('sha256', $sqlStatement),
                'rows' => $rows,
                'affectedRows' => $affectedRows,
                'truncated' => $truncated,
            ];
        } catch (Throwable $error) {
            $failure = [
                'statementIndex' => $index + 1,
                'statementSha256' => hash('sha256', $sqlStatement),
                'message' => $error->getMessage(),
            ];

            break;
        }
    }

    if ($failure !== null && $pdo->inTransaction()) {
        $pdo->rollBack();
    } elseif ($pdo->inTransaction()) {
        // Do not leave an explicit transaction open across HTTP requests.
        $pdo->rollBack();
    }
} finally {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    clear_audit_context($pdo);
}

if ($failure !== null) {
    json_response([
        'error' => 'sql_failed',
        'message' =>
            'SQL statement ' .
            $failure['statementIndex'] .
            ' failed: ' .
            $failure['message'],
        'failedStatement' => $failure,
        'completed' => $results,
        'statementCount' => count($statements),
        'changeId' => $changeId,
    ], 422);
}

$response = [
    'results' => $results,
    'statementCount' => count($statements),
    'changeId' => $changeId,
];

if (count($results) === 1) {
    $response['rows'] = $results[0]['rows'];
    $response['affectedRows'] = $results[0]['affectedRows'];
    $response['truncated'] = $results[0]['truncated'];
}

json_response($response);
