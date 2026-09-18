<?php
declare(strict_types=1);

// Exercise the real SQL endpoint's guards in isolated child processes.
// SQL execution itself requires a MySQL integration environment.
$fixture = sys_get_temp_dir() . '/clocktimer-sql-' . bin2hex(random_bytes(6));
mkdir($fixture);
$bootstrap = <<<'PHP'
<?php
declare(strict_types=1);
$case = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR);
function api_error(string $message, int $status = 400, string $code = 'bad_request'): never {
    echo json_encode(['status'=>$status,'error'=>$code]); exit;
}
function require_method(string ...$allowed): string {
    $method=$GLOBALS['case']['method'] ?? 'POST';
    if (!in_array($method,$allowed,true)) api_error('Method',405,'method_not_allowed');
    return $method;
}
function current_user(): array {
    if (!isset($GLOBALS['case']['mask'])) api_error('Authentication',401,'unauthorized');
    return ['id'=>1,'permissions'=>$GLOBALS['case']['mask']];
}
function api_config(): array { return ['admin_sql_enabled'=>$GLOBALS['case']['enabled'] ?? false, 'admin_migrations_enabled'=>$GLOBALS['case']['migrationsEnabled'] ?? false]; }
function json_input(): array { return $GLOBALS['case']['input'] ?? []; }
function require_string(array $input,string $key): string {
    if (!isset($input[$key]) || !is_string($input[$key]) || trim($input[$key])==='') api_error('Input',422,'invalid_argument');
    return trim($input[$key]);
}
function db(): PDO {
    static $pdo;
    if (!$pdo) {
        $pdo=new PDO('sqlite::memory:');
        $pdo->exec('CREATE TABLE users(id INTEGER,password_hash TEXT)');
        $pdo->prepare('INSERT INTO users VALUES(1,?)')->execute([password_hash('confirm',PASSWORD_BCRYPT)]);
    }
    return $pdo;
}
require __PERMISSIONS__;
require __CSRF__;
$_SERVER['HTTPS']=$case['https'] ?? 'on';
$_SESSION=['csrf_token'=>'valid-token'];
if (($case['csrf'] ?? true) === true) $_SERVER['HTTP_X_CSRF_TOKEN']='valid-token';
PHP;
$bootstrap = str_replace(['__PERMISSIONS__','__CSRF__'],[var_export(realpath(__DIR__.'/../api/_core/permissions.php'),true),var_export(realpath(__DIR__.'/../api/_core/csrf.php'),true)],$bootstrap);
file_put_contents($fixture.'/bootstrap.php',$bootstrap);
$endpoint=file_get_contents(__DIR__.'/../api/admin/sql/index.php');
$endpoint=str_replace("require_once dirname(__DIR__, 2) . '/_core/bootstrap.php';",'require '.var_export($fixture.'/bootstrap.php',true).';',$endpoint);
file_put_contents($fixture.'/endpoint.php',$endpoint);
$valid=['mask'=>4,'enabled'=>true,'input'=>['password'=>'confirm','sql'=>'SELECT 1']];
$cases=[
    ['unknown action rejected',array_merge($valid,['input'=>['action'=>'bad']]),422,'invalid_action'],
    ['migration mode defaults to disabled',array_merge($valid,['input'=>['action'=>'migrate']]),403,'migrations_disabled'],
    ['migration mode remains independent of raw SQL',['mask'=>4,'enabled'=>false,'migrationsEnabled'=>true,'input'=>['action'=>'migrations']],422,'invalid_argument'],
    ['raw SQL remains independent of migration mode',array_merge($valid,['migrationsEnabled'=>true,'enabled'=>false]),403,'sql_disabled'],
    ['GET is rejected',array_merge($valid,['method'=>'GET']),405,'method_not_allowed'],
    ['HTTP is rejected',array_merge($valid,['https'=>'off']),403,'https_required'],
    ['missing HTTPS is rejected',array_merge($valid,['https'=>'']),403,'https_required'],
    ['anonymous is rejected',['enabled'=>true],401,'unauthorized'],
    ['ordinary user is rejected',array_merge($valid,['mask'=>0]),403,'permission_required'],
    ['creator is rejected',array_merge($valid,['mask'=>1]),403,'permission_required'],
    ['editor is rejected',array_merge($valid,['mask'=>2]),403,'permission_required'],
    ['combined admin without superuser is rejected',array_merge($valid,['mask'=>3]),403,'permission_required'],
    ['missing CSRF is rejected',array_merge($valid,['csrf'=>false]),403,'invalid_csrf'],
    ['configuration defaults to disabled',['mask'=>4],403,'sql_disabled'],
    ['explicitly disabled is rejected',array_merge($valid,['enabled'=>false]),403,'sql_disabled'],
    ['password confirmation required',array_merge($valid,['input'=>['sql'=>'SELECT 1']]),422,'invalid_argument'],
    ['wrong password is rejected',array_merge($valid,['input'=>['password'=>'wrong','sql'=>'SELECT 1']]),401,'invalid_credentials'],
    ['empty SQL is rejected',array_merge($valid,['input'=>['password'=>'confirm','sql'=>' ']]),422,'invalid_argument'],
    ['oversized SQL is rejected',array_merge($valid,['input'=>['password'=>'confirm','sql'=>str_repeat('x',65537)]]),422,'invalid_argument'],
];
try {
    foreach ($cases as [$name,$case,$status,$error]) {
        $pipes=[];
        file_put_contents($fixture.'/case.json', json_encode($case, JSON_THROW_ON_ERROR));
        $process=proc_open([PHP_BINARY,'-d','extension_dir='.ini_get('extension_dir'),'-d','extension=pdo_sqlite',$fixture.'/endpoint.php',$fixture.'/case.json'], [1=>['pipe','w'],2=>['pipe','w']],$pipes);
        if (!is_resource($process)) throw new RuntimeException('Unable to launch SQL guard test');
        $output=stream_get_contents($pipes[1]); $stderr=stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]); $exit=proc_close($process);
        $result=json_decode($output,true);
        if ($exit !== 0 || ($result['status'] ?? null)!==$status || ($result['error'] ?? null)!==$error) throw new RuntimeException($name.': '.$output.' '.$stderr);
        echo 'PASS '.$name.PHP_EOL;
    }
    echo count($cases).' SQL guard tests passed.'.PHP_EOL;
} finally {
    if (is_file($fixture.'/case.json')) unlink($fixture.'/case.json');
    unlink($fixture.'/endpoint.php'); unlink($fixture.'/bootstrap.php'); rmdir($fixture);
}
