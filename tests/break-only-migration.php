<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/_core/database.php';
require_once __DIR__ . '/../api/_core/migrations.php';
$dsn = getenv('CLOCKTIMER_TEST_DSN') ?: '';
if (!str_contains($dsn, 'dbname=clocktimer_test;')) throw new RuntimeException('An isolated clocktimer_test database is required.');
$pdo = new PDO($dsn, 'root', getenv('CLOCKTIMER_TEST_PASSWORD'), [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE trips (id BIGINT PRIMARY KEY, standard_time_ms BIGINT UNSIGNED NOT NULL, counted_time_ms BIGINT UNSIGNED NOT NULL DEFAULT 0, non_production TINYINT NOT NULL DEFAULT 0, CONSTRAINT chk_trips_standard_time CHECK (standard_time_ms > 0))');
$pdo->exec('CREATE TABLE event_types (id INT PRIMARY KEY, name VARCHAR(100) NOT NULL)');
$pdo->exec('CREATE TABLE trip_events (id INT PRIMARY KEY, trip_id BIGINT NOT NULL, event_type_id INT NOT NULL, value JSON NOT NULL)');
$pdo->exec("INSERT INTO event_types VALUES (1, 'trip.started')");
$pdo->exec('INSERT INTO trips VALUES (1,600000,600000,0), (2,900000,300000,1)');
$pdo->prepare('INSERT INTO trip_events VALUES (1,2,1,:value)')->execute([':value'=>json_encode(['breakOnly'=>true])]);
$directory = sys_get_temp_dir() . '/clocktimer-break-migration-' . bin2hex(random_bytes(6));
mkdir($directory);
copy(__DIR__.'/../migrations/014_break_only_sessions.php', $directory.'/014_break_only_sessions.php');
function check_break(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
try {
    $result=apply_migration($pdo,'014_break_only_sessions',0,$directory);
    check_break(!$result['alreadyApplied'],'migration executed');
    $row=$pdo->query('SELECT * FROM trips WHERE id=2')->fetch();
    check_break($row['standard_time_ms']===null && (int)$row['counted_time_ms']===0 && (int)$row['non_production']===0 && (int)$row['break_only']===1,'legacy break-only record converted without a standard or production classification');
    $pdo->exec('INSERT INTO trips (id,standard_time_ms,counted_time_ms,non_production,break_only) VALUES (3,NULL,0,0,1)');
    foreach (['(4,NULL,0,0,0)','(5,1000,0,0,1)','(6,NULL,0,1,1)'] as $values) {
        try { $pdo->exec('INSERT INTO trips (id,standard_time_ms,counted_time_ms,non_production,break_only) VALUES '.$values); }
        catch (PDOException $error) { continue; }
        throw new RuntimeException('invalid break-only standard/classification was accepted');
    }
    $totals=$pdo->query('SELECT COUNT(*) AS trips,SUM(standard_time_ms) AS standard,SUM(counted_time_ms) AS counted FROM trips WHERE break_only=0')->fetch();
    check_break((int)$totals['trips']===1 && (int)$totals['standard']===600000 && (int)$totals['counted']===600000,'break-only sessions excluded from aggregate count and times');
    check_break((int)$pdo->query('SELECT COUNT(*) FROM trips')->fetchColumn()===3,'all break-only sessions remain available to log queries');
    check_break(apply_migration($pdo,'014_break_only_sessions',0,$directory)['alreadyApplied'],'migration replay safely skips');
    echo "PASS MariaDB break-only migration, historical conversion, nullable standard/classification constraints, aggregate exclusion, log population and ledger replay\n";
} finally {
    foreach (glob($directory.'/*') ?: [] as $file) unlink($file);
    rmdir($directory);
}
