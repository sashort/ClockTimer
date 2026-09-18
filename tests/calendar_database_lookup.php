<?php
declare(strict_types=1);
$fixture=sys_get_temp_dir().'/calendar-lookup-'.bin2hex(random_bytes(6));mkdir($fixture);
$bootstrap=<<<'PHP'
<?php
$case=json_decode(file_get_contents($argv[1]),true);
$_SERVER['REQUEST_METHOD']=$case['method']??'GET';
$_GET=['range'=>'week','at'=>'2026-09-18T16:00:00Z','timezone'=>'America/New_York'];
function require_method(string ...$allowed):string{return $_SERVER['REQUEST_METHOD'];}
function authenticated_user_id():int{return 2;}
function require_permission(int $mask):array{return ['id'=>2,'permissions'=>4];}
function require_csrf():void{}
const PERMISSION_SUPERUSER=4;
function api_error(string $message,int $status=400,string $code='bad_request'):never{echo json_encode(['status'=>$status,'error'=>$code]);exit;}
function json_response(array $data,int $status=200):never{echo json_encode(['status'=>$status,'data'=>$data]);exit;}
function json_input():array{return $_GET;}
function api_config():array{return ['openai_api_key'=>'synthetic-test-key','calendar_auto_refresh'=>true];}
function db():PDO {
    static $pdo;
    if($pdo)return $pdo;
    $pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    foreach(require __MIGRATION__ as $sql)$pdo->exec($sql);
    if($GLOBALS['case']['saved']??false){
        $rules=['weekStartDay'=>6,'cutoffTime'=>'00:00:00','payPeriodDays'=>14,'payPeriodAnchorDate'=>'2026-01-03','recurring'=>true,'effectiveFrom'=>'1970-01-01','effectiveThrough'=>null];
        calendar_save_record($pdo,'walmart-us',calendar_profiles([])['walmart-us'],['rules'=>$rules,'searchedYear'=>$GLOBALS['case']['year']??2026,'verifiedAt'=>time()-300*86400,'provenance'=>'manual']);
    }
    return $pdo;
}
PHP;
$bootstrap=str_replace('__MIGRATION__',var_export(realpath(__DIR__.'/../migrations/003_calendar_rules.php'),true),$bootstrap);
file_put_contents($fixture.'/bootstrap.php',$bootstrap);
file_put_contents($fixture.'/search.php','<?php function calendar_discover(array $definition,int $year,array $config):array {file_put_contents('.var_export($fixture.'/provider-called',true).',"called");throw new RuntimeException("Unexpected provider call");}');
$endpoint=file_get_contents(__DIR__.'/../api/calendar/index.php');
$endpoint=str_replace("require_once dirname(__DIR__) . '/_core/bootstrap.php';",'require '.var_export($fixture.'/bootstrap.php',true).';',$endpoint);
foreach(['calendar.php','calendar_store.php'] as $file)$endpoint=str_replace("require_once dirname(__DIR__) . '/_core/$file';",'require_once '.var_export(realpath(__DIR__.'/../api/_core/'.$file),true).';',$endpoint);
$endpoint=str_replace("require_once dirname(__DIR__) . '/_core/calendar_search.php';",'require '.var_export($fixture.'/search.php',true).';',$endpoint);
file_put_contents($fixture.'/endpoint.php',$endpoint);
try {
    foreach([
        ['current-year lookup is database-only',['saved'=>true],200],
        ['missing rules never trigger user discovery',['saved'=>false],503],
        ['older stored rules never trigger user discovery',['saved'=>true,'year'=>2025],200],
        ['explicit update reuses already saved year',['saved'=>true,'method'=>'POST'],200],
    ] as [$name,$case,$expected]){
        file_put_contents($fixture.'/case.json',json_encode($case));
        $result=json_decode((string)shell_exec(escapeshellarg(PHP_BINARY).' -d extension_dir='.escapeshellarg(dirname(PHP_BINARY).'/ext').' -d extension=pdo_sqlite '.escapeshellarg($fixture.'/endpoint.php').' '.escapeshellarg($fixture.'/case.json')),true);
        if(($result['status']??null)!==$expected||is_file($fixture.'/provider-called'))throw new RuntimeException($name.': '.json_encode($result));
        if($expected===200&&$result['data']['startTime']!=='2026-09-12T04:00:00.000Z')throw new RuntimeException('Wrong database boundaries');
        echo "PASS $name\n";
    }
    echo "4 database-only endpoint checks passed.\n";
}finally{foreach(['bootstrap.php','search.php','endpoint.php','case.json','provider-called']as$file)if(is_file($fixture.'/'.$file))unlink($fixture.'/'.$file);rmdir($fixture);}
