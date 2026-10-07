<?php
declare(strict_types=1);
class LoginFailure extends RuntimeException {public function __construct(public string $apiCode){parent::__construct($apiCode);}}
function api_error(string $message,int $status=400,string $code='bad_request'):never{throw new LoginFailure($code);}
require_once __DIR__.'/../api/_core/voice_login.php';
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
function rejected(callable $fn,string $code):void{try{$fn();}catch(LoginFailure $e){check($e->apiCode===$code,'Wrong rejection');return;}throw new RuntimeException('Expected rejection');}
class LoginTestPDO extends PDO {public function prepare(string $query,array $options=[]):PDOStatement|false{return parent::prepare(str_replace(' FOR UPDATE','',$query),$options);}}
$db=new LoginTestPDO('sqlite::memory:');$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$db->exec('CREATE TABLE users(id INTEGER PRIMARY KEY,first_name TEXT,last_name TEXT,preferred_name TEXT,username TEXT,permissions INTEGER,login_id TEXT UNIQUE,pin_hash TEXT)');
$db->exec('CREATE TABLE voice_login_attempts(bucket TEXT PRIMARY KEY,window_start INTEGER,attempts INTEGER)');
$db->prepare('INSERT INTO users VALUES(1,?,?,?,?,?,?,?)')->execute(['Test','User','Test','legacy-name',0,'0042',password_hash('0073',PASSWORD_BCRYPT)]);
check(four_digit_credential('0042','id')==='0042','Leading zero lost');
foreach([42,'123','12345','12.3','1e03','１２３４']as$v)rejected(fn()=>four_digit_credential($v,'id'),'invalid_argument');
$user=authenticate_voice_login($db,['loginId'=>'0042','pin'=>'0073'],'origin',1000);check($user['id']===1&&!isset($user['pin_hash']),'Valid match/hash exposure');
for($i=0;$i<5;$i++)rejected(fn()=>authenticate_voice_login($db,['loginId'=>'0042','pin'=>'9999'],'origin-'.$i,1001),'invalid_credentials');
rejected(fn()=>authenticate_voice_login($db,['loginId'=>'0042','pin'=>'0073'],'new-origin',1002),'login_rate_limited');
check(authenticate_voice_login($db,['loginId'=>'0042','pin'=>'0073'],'origin',1062)['id']===1,'Window did not recover');
rejected(fn()=>authenticate_voice_login($db,['loginId'=>'9999','pin'=>'0073'],'other',1063),'invalid_credentials');
rejected(fn()=>authenticate_voice_login($db,['loginId'=>'0042','pin'=>'7.3'],'other',1063),'invalid_argument');
check($db->query('SELECT username FROM users')->fetchColumn()==='legacy-name','Legacy username modified');
echo "PASS leading zeros, strict four digits, matching credentials, secret omission, account rate limit independent of origin, recovery and legacy identity\n";

require_once __DIR__.'/../api/_core/permissions.php';
require_once __DIR__.'/../api/_core/user_accounts.php';
function authenticated_user_id():int{return 1;}
function require_positive_int(array $input,string $field):int{return (int)$input[$field];}
function require_string(array $input,string $field,bool $empty=false):string{return $input[$field];}
rejected(fn()=>save_user_account($db,['action'=>'update','userId'=>1,'loginId'=>'0043','pin'=>'0084'],false),'permission_required');
$db->exec('UPDATE users SET permissions=2 WHERE id=1');
$result=save_user_account($db,['action'=>'update','userId'=>1,'loginId'=>'0043','pin'=>'0084'],false);
check($result['id']===1,'Account primary ID must not change');
check(authenticate_voice_login($db,['loginId'=>'0043','pin'=>'0084'],'admin-test',1200)['id']===1,'Admin assignment did not persist');
rejected(fn()=>authenticate_voice_login($db,['loginId'=>'0042','pin'=>'0073'],'admin-test',1201),'invalid_credentials');
$stored=$db->query('SELECT pin_hash FROM users WHERE id=1')->fetchColumn();check($stored!=='0084'&&password_verify('0084',$stored),'PIN must be hashed');
echo "PASS administrator-only assignment, hashed PIN, stable primary ID and replaced credentials\n";
