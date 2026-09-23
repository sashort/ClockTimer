<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
function api_error(string $message, int $status = 400, string $code = 'bad_request'): never
{
    throw new RuntimeException($code . ': ' . $message);
}
require_once __DIR__ . '/../api/_core/database.php';
require_once __DIR__ . '/../api/_core/migrations.php';
require_once __DIR__ . '/../api/_core/calendar.php';
require_once __DIR__ . '/../api/_core/calendar_store.php';
try {
    $directory = migration_directory();
    if (!is_file($directory . '/applied.json')) {
        if (file_put_contents($directory . '/applied.json', "{\"migrations\":[]}\n") === false) {
            throw new RuntimeException('Unable to create migration ledger.');
        }
    }
    // Bitnami Apache runs PHP as daemon. Scripts remain deployment-owned.
    if (!chown($directory . '/applied.json', 'daemon') || !chmod($directory . '/applied.json', 0600)) {
        throw new RuntimeException('Unable to prepare writable migration ledger.');
    }
    $pdo = db();
    foreach (['001_admin_permissions', '002_bootstrap_superuser', '003_calendar_rules', '005_developer_permissions'] as $id) {
        $result = apply_migration($pdo, $id, 0);
        echo $id . ($result['alreadyApplied'] ? " already recorded.\n" : " applied and recorded.\n");
    }
    // One-time import preserves previously discovered calendars without provider calls.
    foreach (calendar_profiles(api_config()) as $profile => $definition) {
        $legacy = calendar_cached_record(calendar_cache_directory(api_config()), $profile);
        if ($legacy && ($legacy['definitionHash'] ?? null) === calendar_definition_hash($profile, $definition)
            && is_int($legacy['searchedYear'] ?? null) && is_int($legacy['verifiedAt'] ?? null)) {
            calendar_with_lock($pdo, $profile, static function () use ($pdo, $profile, $definition, $legacy): void {
                $existing = calendar_stored_record($pdo, $profile, $definition, $legacy['searchedYear']);
                if (!$existing || $existing['searchedYear'] !== $legacy['searchedYear']) calendar_save_record($pdo, $profile, $definition, $legacy);
            });
        }
    }
    $configPath = '/etc/clocktimer/config.php';
    $config = api_config();
    if (($config['admin_migrations_enabled'] ?? false) !== true || ($config['admin_sql_enabled'] ?? false) !== true) {
        $config['admin_migrations_enabled'] = true;
        $config['admin_sql_enabled'] = true;
        $text = "<?php\nreturn " . var_export($config, true) . ";\n";
        if (file_put_contents($configPath, $text, LOCK_EX) !== strlen($text)) {
            throw new RuntimeException('Unable to enable guarded migrations.');
        }
    }
    echo "Guarded migration and raw SQL modes enabled.\n";
} catch (Throwable $error) {
    fwrite(STDERR, 'Migration setup failed: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
