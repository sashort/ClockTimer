<?php
declare(strict_types=1);

class MigrationFailure extends RuntimeException
{
    public function __construct(string $message, public int $status = 409, public string $apiCode = 'migration_conflict')
    {
        parent::__construct($message);
    }
}

function migration_directory(): string
{
    return dirname(__DIR__, 2) . '/migrations';
}

function migration_statements(string $id, ?string $directory = null): array
{
    if (!preg_match('/^[0-9]{3}_[a-z0-9_]{1,80}$/D', $id)) {
        throw new MigrationFailure('Invalid migration identifier.', 422, 'invalid_argument');
    }
    $path = ($directory ?? migration_directory()) . '/' . $id . '.php';
    if (!is_file($path)) throw new MigrationFailure('Migration was not found.', 404, 'migration_not_found');
    $statements = require $path;
    if (!is_array($statements) || !array_is_list($statements) || $statements === []) {
        throw new MigrationFailure('Migration must return a nonempty SQL statement list.', 422, 'invalid_migration');
    }
    foreach ($statements as $sql) {
        if (!is_string($sql) || trim($sql) === '') {
            throw new MigrationFailure('Each migration statement must be a nonempty string.', 422, 'invalid_migration');
        }
    }
    return ['id' => $id, 'checksum' => hash_file('sha256', $path), 'statements' => $statements];
}

function initialize_migration_store(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(100) NOT NULL PRIMARY KEY,
        checksum VARCHAR(64) NOT NULL,
        status VARCHAR(16) NOT NULL,
        user_id BIGINT NOT NULL,
        change_id VARCHAR(36) NOT NULL,
        applied_at VARCHAR(32) NULL
    )');
}

function migration_records(PDO $pdo): array
{
    return $pdo->query('SELECT id, checksum, status, user_id, change_id, applied_at FROM schema_migrations ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
}

function write_migration_ledger(PDO $pdo, ?string $directory = null): array
{
    $records = migration_records($pdo);
    $payload = ['migrations' => $records];
    $file = fopen(($directory ?? migration_directory()) . '/applied.json', 'c+');
    if ($file === false) throw new MigrationFailure('Applied-migrations file is not writable.', 500, 'migration_ledger_unavailable');
    try {
        if (!flock($file, LOCK_EX)) throw new MigrationFailure('Unable to lock migration ledger.', 500, 'migration_ledger_unavailable');
        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
        rewind($file);
        if (!ftruncate($file, 0) || fwrite($file, $json) !== strlen($json) || !fflush($file)) {
            throw new MigrationFailure('Unable to write migration ledger.', 500, 'migration_ledger_unavailable');
        }
    } finally {
        flock($file, LOCK_UN);
        fclose($file);
    }
    return $payload;
}

function with_migration_lock(PDO $pdo, callable $callback): mixed
{
    $mysql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    if ($mysql && (int) $pdo->query("SELECT GET_LOCK('clocktimer_migrations', 10)")->fetchColumn() !== 1) {
        throw new MigrationFailure('Another migration is running.', 409, 'migration_busy');
    }
    try {
        initialize_migration_store($pdo);
        return $callback();
    } finally {
        if ($mysql) $pdo->query("SELECT RELEASE_LOCK('clocktimer_migrations')")->closeCursor();
    }
}

function migration_status(PDO $pdo, ?string $directory = null): array
{
    return with_migration_lock($pdo, static function () use ($pdo, $directory): array {
        $ledger = write_migration_ledger($pdo, $directory);
        $ledger['available'] = array_map(
            static fn (string $path): string => basename($path, '.php'),
            glob(($directory ?? migration_directory()) . '/[0-9][0-9][0-9]_*.php') ?: []
        );
        return $ledger;
    });
}

function apply_migration(PDO $pdo, string $id, int $userId, ?string $directory = null): array
{
    $migration = migration_statements($id, $directory);
    return with_migration_lock($pdo, static function () use ($pdo, $migration, $userId, $directory): array {
        $id = $migration['id'];
        $find = $pdo->prepare('SELECT checksum, status FROM schema_migrations WHERE id = :id');
        $find->execute([':id' => $id]);
        $existing = $find->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            if (!hash_equals($existing['checksum'], $migration['checksum'])) {
                throw new MigrationFailure('An applied or attempted migration was changed. Create a new migration instead.');
            }
            if ($existing['status'] !== 'applied') {
                throw new MigrationFailure('This migration failed or was interrupted. Reconcile its database effects before recovery.');
            }
            write_migration_ledger($pdo, $directory);
            return ['migration' => $id, 'applied' => true, 'alreadyApplied' => true];
        }
        foreach (migration_records($pdo) as $record) {
            if ($record['status'] !== 'applied') throw new MigrationFailure('A previous migration needs recovery.');
            if (strcmp($record['id'], $id) > 0) throw new MigrationFailure('Migrations must be applied in filename order.');
        }
        foreach (glob(($directory ?? migration_directory()) . '/[0-9][0-9][0-9]_*.php') ?: [] as $path) {
            $earlier = basename($path, '.php');
            if (strcmp($earlier, $id) < 0) {
                $find->execute([':id' => $earlier]);
                if (!$find->fetch()) throw new MigrationFailure('Apply earlier migrations first.');
            }
        }
        $changeId = uuid_v4();
        $pdo->prepare('INSERT INTO schema_migrations (id, checksum, status, user_id, change_id) VALUES (:id, :checksum, :status, :user_id, :change_id)')
            ->execute([':id' => $id, ':checksum' => $migration['checksum'], ':status' => 'applying', ':user_id' => $userId, ':change_id' => $changeId]);
        // The durable "applying" record makes a crash or implicit DDL commit visible.
        write_migration_ledger($pdo, $directory);
        $mysql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
        try {
            if ($mysql) {
                $pdo->prepare('SET @audit_user_id = :user_id, @audit_change_id = :change_id, @audit_sequence = 0, @audit_reversal_of = NULL')
                    ->execute([':user_id' => $userId, ':change_id' => $changeId]);
            }
            $pdo->beginTransaction();
            foreach ($migration['statements'] as $sql) {
                $statement = $pdo->query($sql);
                $statement->closeCursor();
            }
            if ($pdo->inTransaction()) $pdo->commit();
            $pdo->prepare("UPDATE schema_migrations SET status = 'applied', applied_at = :applied_at WHERE id = :id")
                ->execute([':applied_at' => gmdate('Y-m-d\TH:i:s\Z'), ':id' => $id]);
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            $pdo->prepare("UPDATE schema_migrations SET status = 'failed' WHERE id = :id")->execute([':id' => $id]);
            write_migration_ledger($pdo, $directory);
            throw $error;
        } finally {
            if ($mysql) clear_audit_context($pdo);
        }
        write_migration_ledger($pdo, $directory);
        return ['migration' => $id, 'applied' => true, 'alreadyApplied' => false, 'changeId' => $changeId];
    });
}
