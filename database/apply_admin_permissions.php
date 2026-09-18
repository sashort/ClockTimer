<?php
declare(strict_types=1);

// This is a CLI entry point for the fixed, reviewed admin permission seed.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
function api_error(string $message, int $status = 400, string $code = 'bad_request'): never
{
    throw new RuntimeException($code . ': ' . $message);
}
require_once __DIR__ . '/../api/_core/database.php';
$pdo = null;
try {
    $sql = file_get_contents(__DIR__ . '/admin_permissions.sql');
    if ($sql === false) throw new RuntimeException('Permission migration is missing.');
    // This migration has no procedures or semicolons inside SQL literals.
    // This is not a general-purpose SQL migration parser.
    $sql = preg_replace('/^--.*$/m', '', $sql);
    $pdo = db();
    foreach (explode(';', $sql) as $statement) {
        if (trim($statement) !== '') $pdo->exec(trim($statement));
    }
    $rows = $pdo->query('SELECT value, name FROM permissions WHERE value IN (1, 2, 4) ORDER BY value')->fetchAll();
    if (array_column($rows, 'name') !== ['create_users', 'modify_users', 'superuser']) {
        throw new RuntimeException('Permission migration verification failed.');
    }
    echo "Administrative permission migration applied and verified.\n";
} catch (Throwable $error) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, 'Migration failed: ' . $error->getMessage() . PHP_EOL);
    exit(1);
} finally {
    if ($pdo instanceof PDO) clear_audit_context($pdo);
}
