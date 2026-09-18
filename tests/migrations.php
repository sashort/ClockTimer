<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/_core/migrations.php';
function uuid_v4(): string { return bin2hex(random_bytes(16)); }
$directory = sys_get_temp_dir() . '/clocktimer-migrations-' . bin2hex(random_bytes(6));
mkdir($directory);
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$passed=0;
function test(string $name, callable $callback): void { $callback(); $GLOBALS['passed']++; echo 'PASS '.$name.PHP_EOL; }
function expect(bool $condition): void { if (!$condition) throw new RuntimeException('Assertion failed'); }
function rejects(callable $fn, int $status): void { try {$fn();} catch(MigrationFailure $e) {expect($e->status===$status);return;} throw new RuntimeException('Expected rejection'); }
function script(string $id,array $statements): void { file_put_contents($GLOBALS['directory'].'/'.$id.'.php', '<?php return '.var_export($statements,true).';'); }
try {
    script('001_create_fixture',['CREATE TABLE fixture (id INTEGER PRIMARY KEY, value TEXT)','INSERT INTO fixture VALUES (1, "semicolon; value")']);
    script('002_insert_fixture',['INSERT INTO fixture VALUES (2, "second")']);
    test('path traversal rejected',fn()=>rejects(fn()=>migration_statements('../secret',$directory),422));
    test('unknown script rejected',fn()=>rejects(fn()=>migration_statements('999_missing',$directory),404));
    test('out of order rejected',fn()=>rejects(fn()=>apply_migration($pdo,'002_insert_fixture',42,$directory),409));
    $r=apply_migration($pdo,'001_create_fixture',42,$directory);
    test('migration applied',fn()=>expect($r['applied'] && !$r['alreadyApplied']));
    test('all statements execute',fn()=>expect($pdo->query('SELECT value FROM fixture WHERE id=1')->fetchColumn()==='semicolon; value'));
    $ledger=json_decode(file_get_contents($directory.'/applied.json'),true);
    test('ledger records applied migration',fn()=>expect($ledger['migrations'][0]['status']==='applied' && $ledger['migrations'][0]['id']==='001_create_fixture'));
    test('ledger records actor',fn()=>expect((int)$ledger['migrations'][0]['user_id']===42));
    test('ledger records checksum and time',fn()=>expect(strlen($ledger['migrations'][0]['checksum'])===64 && $ledger['migrations'][0]['applied_at']!==null));
    test('replay safely skipped',fn()=>expect(apply_migration($pdo,'001_create_fixture',42,$directory)['alreadyApplied']));
    test('replay does not duplicate data',fn()=>expect((int)$pdo->query('SELECT COUNT(*) FROM fixture')->fetchColumn()===1));
    file_put_contents($directory.'/001_create_fixture.php',"\n// changed",FILE_APPEND);
    test('modified applied migration rejected',fn()=>rejects(fn()=>apply_migration($pdo,'001_create_fixture',42,$directory),409));
    apply_migration($pdo,'002_insert_fixture',42,$directory);
    test('next migration executes',fn()=>expect((int)$pdo->query('SELECT COUNT(*) FROM fixture')->fetchColumn()===2));
    file_put_contents($directory.'/applied.json','corrupt');
    $status=migration_status($pdo,$directory);
    test('status repairs ledger from database',fn()=>expect(count(json_decode(file_get_contents($directory.'/applied.json'),true)['migrations'])===2));
    test('status lists available scripts',fn()=>expect(count($status['available'])===2));
    script('003_invalid_fixture',['INSERT INTO fixture VALUES(3,"rolled back")','INVALID SQL']);
    try { apply_migration($pdo,'003_invalid_fixture',42,$directory); throw new RuntimeException('Failure expected'); } catch (PDOException) {}
    test('failed DML rolled back',fn()=>expect((int)$pdo->query('SELECT COUNT(*) FROM fixture')->fetchColumn()===2));
    test('failure recorded',fn()=>expect($pdo->query("SELECT status FROM schema_migrations WHERE id='003_invalid_fixture'")->fetchColumn()==='failed'));
    test('failed replay blocked',fn()=>rejects(fn()=>apply_migration($pdo,'003_invalid_fixture',42,$directory),409));
    script('004_later_fixture',['SELECT 1']);
    test('later migration blocked after failure',fn()=>rejects(fn()=>apply_migration($pdo,'004_later_fixture',42,$directory),409));
    script('005_empty_fixture',[]);
    test('empty migration rejected',fn()=>rejects(fn()=>migration_statements('005_empty_fixture',$directory),422));
    test('existing applied migration still skipped',fn()=>expect(apply_migration($pdo,'002_insert_fixture',42,$directory)['alreadyApplied']));
    echo $passed.' migration tests passed.'.PHP_EOL;
} finally {
    foreach(glob($directory.'/*')?:[] as $path) unlink($path);
    rmdir($directory);
}
