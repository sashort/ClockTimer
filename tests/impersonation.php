<?php
declare(strict_types=1);
class ApiFailure extends RuntimeException {public function __construct(public int $status,public string $apiCode){parent::__construct($apiCode);}}
function api_error(string $message,int $status=400,string $code='bad_request'):never{throw new ApiFailure($status,$code);}
class FixturePDO extends PDO {public function prepare(string $sql,array $options=[]):PDOStatement|false{return parent::prepare(str_replace(' FOR UPDATE','',$sql),$options);}}
$pdo=new FixturePDO('sqlite::memory:');$pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);
function db():PDO{return $GLOBALS['pdo'];}
function uuid_v4():string{return bin2hex(random_bytes(16));}
function authenticated_user_id():int{return (int)($_SESSION['user_id']??0);}
require_once __DIR__.'/../api/_core/permissions.php';
require_once __DIR__.'/../api/_core/access_tokens.php';
require_once __DIR__.'/../api/_core/user_accounts.php';
require_once __DIR__.'/../api/_core/impersonation.php';
$source=file_get_contents(__DIR__.'/../api/_core/response.php');eval(substr($source,strpos($source,'function require_string')));
$pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY,first_name TEXT,middle_name TEXT,last_name TEXT,preferred_name TEXT,username TEXT,permissions INTEGER,login_id TEXT)');
$pdo->exec("INSERT INTO users VALUES (1,'Operator',NULL,'Test',NULL,'operator',4,'0001'),(2,'Target',NULL,'Test',NULL,'target',0,'0072'),(3,'Admin',NULL,'Test',NULL,'admin',4,'0003')");
$pdo->exec('CREATE TABLE access_tokens (id INTEGER PRIMARY KEY,owner_user_id INTEGER,name TEXT,token_hash TEXT,permissions INTEGER,new_user INTEGER DEFAULT 0,uses_remaining INTEGER,delete_on_deplete INTEGER,requires_authentication INTEGER DEFAULT 0,expires_at INTEGER,last_used_at INTEGER)');
$pdo->exec('CREATE TABLE impersonation_sessions (id TEXT PRIMARY KEY,actor_user_id INTEGER,target_user_id INTEGER,token_id INTEGER,authentication TEXT,started_at INTEGER,ended_at INTEGER,end_reason TEXT)');
function token(int $id,int $permissions=256,int $uses=2,int $delete=0):string{
 $raw='wmof_'.str_repeat((string)$id,40);
 db()->prepare('INSERT INTO access_tokens (id,owner_user_id,name,token_hash,permissions,uses_remaining,delete_on_deplete,expires_at) VALUES (?,1,?,?,?,?,?,?)')->execute([$id,'Test',access_token_hash($raw),$permissions,$uses,$delete,time()+600]);return $raw;
}
function check(bool $value,string $message):void{if(!$value)throw new RuntimeException($message);}
function rejects(callable $call,string $code):void{try{$call();}catch(ApiFailure $e){check($e->apiCode===$code,'Expected '.$code.', got '.$e->apiCode);return;}throw new RuntimeException('Expected '.$code);}
function uses(int $id):mixed{return db()->query('SELECT uses_remaining FROM access_tokens WHERE id='.$id)->fetchColumn();}
session_start();$_SESSION=[];
check(impersonation_credential_token('1234')===null,'Normal PIN unchanged');
check(impersonation_credential_token('password')===null,'Normal password unchanged');
check(impersonation_credential_token(' wmof_test ')==='wmof_test','Token recognized in either field');
$bad=token(1,16);rejects(fn()=>impersonation_token_login($bad,['username'=>'target']),'permission_required');check(uses(1)===2,'Permission failure cannot consume');
$valid=token(2);rejects(fn()=>impersonation_token_login($valid,['username'=>'missing']),'user_not_found');check(uses(2)===2,'Missing target cannot consume');
rejects(fn()=>impersonation_token_login($valid,['username'=>'admin']),'permission_required');check(uses(2)===2,'Impersonate-only token cannot become Superuser');
$pdo->exec("CREATE TRIGGER audit_failure BEFORE INSERT ON impersonation_sessions BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
try{impersonation_token_login($valid,['username'=>'target']);throw new RuntimeException('Audit failure accepted');}catch(PDOException){}
check(uses(2)===2,'Audit failure rolls token consumption back');$pdo->exec('DROP TRIGGER audit_failure');
$_SESSION=['user_id'=>1,'csrf_token'=>'old','access_token_grants'=>['sql'=>['permissions'=>4]]];$before=session_id();
$user=impersonation_token_login($valid,['username'=>'target']);
check($user['id']===2&&$_SESSION['user_id']===2,'Session becomes target');
check(session_id()!==$before&&$_SESSION['csrf_token']!=='old','Session and CSRF rotate');
check(!isset($_SESSION['access_token_grants']),'Source grants cleared');check(uses(2)===1,'Exactly one successful use consumed');
$record=$pdo->query('SELECT * FROM impersonation_sessions')->fetch();check((int)$record['actor_user_id']===1&&(int)$record['target_user_id']===2,'Actor and target recorded');
$pdo->exec('UPDATE users SET permissions=0 WHERE id=1');rejects(fn()=>impersonation_return($pdo),'permission_required');
$pdo->exec('UPDATE users SET permissions=4 WHERE id=1');$original=impersonation_return($pdo);check($original['id']===1&&!isset($_SESSION['impersonation']),'Return restores actual original login');
check($pdo->query('SELECT end_reason FROM impersonation_sessions')->fetchColumn()==='return','Return recorded');
$_SESSION=[];$once=token(3,256,1,1);$user=impersonation_token_login($once,['action'=>'connect-pin','loginId'=>'0072']);
check($user['id']===2,'PIN login accepts token without four-digit PIN parsing');check(uses(3)===false,'Final use deletes depleted token');
check($_SESSION['impersonation']['return_user_id']===null,'Anonymous token holder cannot become token owner');
rejects(fn()=>impersonation_return($pdo),'operator_login_required');
impersonation_end($pdo,'logout');check(!isset($_SESSION['impersonation']),'Logout discards return capability');
check((int)$pdo->query('SELECT COUNT(*) FROM impersonation_sessions')->fetchColumn()===2,'Only successful impersonations audited');
session_destroy();echo "PASS impersonation permissions, atomic token/audit use, PIN and password token routing, privilege isolation, return and logout\n";
