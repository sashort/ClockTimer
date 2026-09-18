<?php
declare(strict_types=1);

function api_config(): array
{
    static $config;

    if ($config !== null) {
        return $config;
    }

    $path = '/etc/clocktimer/config.php';

    if (!is_file($path)) {
        api_error('Server configuration is unavailable.', 500, 'server_configuration');
    }

    $loaded = require $path;

    if (!is_array($loaded) || !isset($loaded['database']) || !is_array($loaded['database'])) {
        api_error('Server configuration is invalid.', 500, 'server_configuration');
    }

    $config = $loaded;
    return $config;
}

function db(): PDO
{
    static $pdo;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $db = api_config()['database'];

    foreach (['host', 'port', 'name', 'username', 'password'] as $key) {
        if (!array_key_exists($key, $db)) {
            api_error('Database configuration is incomplete.', 500, 'server_configuration');
        }
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        (string) $db['host'],
        (int) $db['port'],
        (string) $db['name']
    );

    try {
        $pdo = new PDO(
            $dsn,
            (string) $db['username'],
            (string) $db['password'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_PERSISTENT => false,
                PDO::MYSQL_ATTR_MULTI_STATEMENTS => false,
            ]
        );
        $pdo->exec("SET time_zone = '+00:00'");
    } catch (Throwable) {
        api_error('Database connection failed.', 500, 'database_unavailable');
    }

    return $pdo;
}

function uuid_v4(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);

    return sprintf(
        '%s-%s-%s-%s-%s',
        substr($hex, 0, 8),
        substr($hex, 8, 4),
        substr($hex, 12, 4),
        substr($hex, 16, 4),
        substr($hex, 20, 12)
    );
}

function clear_audit_context(PDO $pdo): void
{
    try {
        $pdo->exec('SET @audit_user_id = NULL, @audit_change_id = NULL, @audit_sequence = NULL, @audit_reversal_of = NULL');
    } catch (Throwable) {
    }
}

function audited_write(callable $callback, ?string $reversalOf = null): mixed
{
    $pdo = db();
    $userId = authenticated_user_id();
    $changeId = uuid_v4();

    try {
        $pdo->beginTransaction();

        $statement = $pdo->prepare(
            'SET @audit_user_id = :user_id, @audit_change_id = :change_id, @audit_sequence = 0, @audit_reversal_of = :reversal_of'
        );
        $statement->execute([
            ':user_id' => $userId,
            ':change_id' => $changeId,
            ':reversal_of' => $reversalOf,
        ]);

        $result = $callback($pdo, $changeId);
        $pdo->commit();
        clear_audit_context($pdo);
        return $result;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        clear_audit_context($pdo);
        throw $error;
    }
}
