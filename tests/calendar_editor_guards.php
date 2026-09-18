<?php
declare(strict_types=1);
$fixture = sys_get_temp_dir() . '/calendar-guards-' . bin2hex(random_bytes(6));
mkdir($fixture);
$bootstrap = <<<'PHP'
<?php
$case=json_decode(file_get_contents($argv[1]),true);
$_SERVER['REQUEST_METHOD']=$case['method']??'POST';
$_SERVER['HTTPS']=$case['https']??'on';
$_SESSION=['csrf_token'=>'valid-token'];
if ($case['csrf']??true) $_SERVER['HTTP_X_CSRF_TOKEN']='valid-token';
if ($case['editor']??false) $_GET['editor']='1';
function api_error(string $message,int $status=400,string $code='bad_request'):never {echo json_encode(['status'=>$status,'error'=>$code]);exit;}
function require_method(string ...$methods):string {if(!in_array($_SERVER['REQUEST_METHOD'],$methods,true))api_error('method',405,'method_not_allowed');return $_SERVER['REQUEST_METHOD'];}
function current_user():array {if(!isset($GLOBALS['case']['mask']))api_error('auth',401,'unauthorized');return ['id'=>2,'permissions'=>$GLOBALS['case']['mask']];}
function api_config():array {return [];}
function json_input():array {return $GLOBALS['case']['input']??[];}
function db():PDO {throw new LogicException('Invalid request must not reach database');}
PHP;
$bootstrap .= "\nrequire " . var_export(realpath(__DIR__.'/../api/_core/permissions.php'),true) . ";\nrequire " . var_export(realpath(__DIR__.'/../api/_core/csrf.php'),true) . ";";
file_put_contents($fixture.'/bootstrap.php',$bootstrap);
$endpoint=file_get_contents(__DIR__.'/../api/admin/calendar/index.php');
$endpoint=str_replace("require_once dirname(__DIR__, 2) . '/_core/bootstrap.php';",'require '.var_export($fixture.'/bootstrap.php',true).';',$endpoint);
foreach(['calendar.php','calendar_store.php','calendar_editor.php'] as $file) {
    $endpoint=str_replace("require_once dirname(__DIR__, 2) . '/_core/$file';",'require_once '.var_export(realpath(__DIR__.'/../api/_core/'.$file),true).';',$endpoint);
}
file_put_contents($fixture.'/endpoint.php',$endpoint);
$cases=[
    ['anonymous editor blocked',['method'=>'GET','editor'=>true],401],
    ['ordinary editor blocked',['mask'=>0,'method'=>'GET','editor'=>true],403],
    ['user administrator cannot edit calendar',['mask'=>3],403],
    ['HTTPS required',['mask'=>4,'https'=>'off'],403],
    ['save requires CSRF',['mask'=>4,'csrf'=>false],403],
    ['unsupported method rejected',['mask'=>4,'method'=>'DELETE'],405],
    ['unknown profile rejected',['mask'=>4,'input'=>['profile'=>'other']],422],
    ['invalid year rejected',['mask'=>4,'input'=>['year'=>'abc']],422],
    ['missing rules rejected',['mask'=>4,'input'=>['year'=>2026]],422],
];
try {
    foreach($cases as [$name,$input,$expected]) {
        file_put_contents($fixture.'/case.json',json_encode($input));
        $cmd=escapeshellarg(PHP_BINARY).' '.escapeshellarg($fixture.'/endpoint.php').' '.escapeshellarg($fixture.'/case.json');
        $result=json_decode((string)shell_exec($cmd),true);
        if(($result['status']??null)!==$expected)throw new RuntimeException($name.': '.json_encode($result));
        echo "PASS $name\n";
    }
    echo "9 calendar endpoint guard checks passed.\n";
} finally {foreach(['bootstrap.php','endpoint.php','case.json'] as $file)unlink($fixture.'/'.$file);rmdir($fixture);}
