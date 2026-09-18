<?php
declare(strict_types=1);

// Run: php -d extension=pdo_sqlite tests/admin_permissions.php
class ApiFailure extends RuntimeException {
    public function __construct(public int $status, public string $apiCode) { parent::__construct($apiCode); }
}
function api_error(string $message, int $status = 400, string $code = 'bad_request'): never {
    throw new ApiFailure($status, $code);
}
function authenticated_user_id(): int { return $GLOBALS['actorId']; }
require_once __DIR__ . '/../api/_core/permissions.php';
require_once __DIR__ . '/../api/_core/user_accounts.php';
// Use the real input-validation helpers; api_error above replaces HTTP exits.
$source = file_get_contents(__DIR__ . '/../api/_core/response.php');
$start = strpos($source, 'function require_string');
eval(substr($source, $start));

// SQLite fixture runs real account queries, stripping MySQL's locking clause.
class FixturePDO extends PDO {
    public function prepare(string $query, array $options = []): PDOStatement|false {
        return parent::prepare(str_replace(' FOR UPDATE', '', $query), $options);
    }
}
$pdo = new FixturePDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL, last_name TEXT NOT NULL, preferred_name TEXT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, permissions INTEGER NOT NULL DEFAULT 0)');
$seed = $pdo->prepare('INSERT INTO users VALUES (?, ?, ?, NULL, ?, ?, ?)');
foreach ([1=>0, 2=>1, 3=>2, 4=>4] as $id=>$mask) $seed->execute([$id,'First','Last','user'.$id,password_hash('test', PASSWORD_BCRYPT),$mask]);
$passed = 0;
function test(string $name, callable $callback): void {
    $callback();
    $GLOBALS['passed']++;
    echo "PASS " . $name . PHP_EOL;
}
function expect(bool $condition): void { if (!$condition) throw new RuntimeException('Assertion failed'); }
function rejects(callable $callback, int $status, string $code): void {
    try { $callback(); } catch (ApiFailure $error) {
        expect($error->status === $status && $error->apiCode === $code);
        return;
    }
    throw new RuntimeException('Expected API rejection');
}
$normal=['id'=>1,'permissions'=>0]; $creator=['id'=>2,'permissions'=>1];
$editor=['id'=>3,'permissions'=>2]; $super=['id'=>4,'permissions'=>4];
test('no permissions by default', fn()=>expect(!has_permission($normal,1)));
test('creator cannot modify others', fn()=>rejects(fn()=>require_user_edit_access($creator,$normal),403,'permission_required'));
test('editor may modify others', fn()=>require_user_edit_access($editor,$normal));
test('own account editing is implicit', fn()=>require_user_edit_access($normal,$normal));
test('normal user cannot edit others', fn()=>rejects(fn()=>require_user_edit_access($normal,$creator),403,'permission_required'));
test('editor cannot modify superuser', fn()=>rejects(fn()=>require_user_edit_access($editor,$super),403,'permission_required'));
test('superuser can modify superuser', fn()=>require_user_edit_access($super,['id'=>5,'permissions'=>4]));
test('superuser implies create and modify', fn()=>expect(has_permission($super,1) && has_permission($super,2)));
foreach ([$normal,$creator,$editor] as $actor) test('cannot assign permissions: '.$actor['id'], fn()=>rejects(fn()=>require_permission_assignment($actor,4),403,'permission_required'));
foreach ([-1,8,'4',1.5,true] as $value) test('invalid permission mask '.json_encode($value), fn()=>rejects(fn()=>require_permission_assignment($super,$value),422,'invalid_argument'));
test('combined permission mask', fn()=>expect(require_permission_assignment($super,7)===7));
test('revoke permissions', fn()=>expect(require_permission_assignment($super,0)===0));
$input=['firstName'=>' Test ','lastName'=>'Account','username'=>'temp-account','password'=>' with spaces '];
$GLOBALS['actorId']=1;
test('normal user cannot create', fn()=>rejects(fn()=>save_user_account($pdo,$input,true),403,'permission_required'));
$GLOBALS['actorId']=2;
$new=save_user_account($pdo,$input,true);
test('creator creates ordinary account', fn()=>expect($new['permissions']===0 && $new['first_name']==='Test'));
test('hash never returned', fn()=>expect(!isset($new['password_hash'])));
test('password spaces preserved', function() use($pdo,$new) { $s=$pdo->prepare('SELECT password_hash FROM users WHERE id=?'); $s->execute([$new['id']]); expect(password_verify(' with spaces ',$s->fetchColumn())); });
test('creator cannot create elevated account', fn()=>rejects(fn()=>save_user_account($pdo,array_merge($input,['username'=>'elevated','permissions'=>4]),true),403,'permission_required'));
$GLOBALS['actorId']=1;
test('self profile update', fn()=>expect(save_user_account($pdo,['preferredName'=>'Bob'],false)['preferred_name']==='Bob'));
test('self cannot escalate', fn()=>rejects(fn()=>save_user_account($pdo,['permissions'=>4],false),403,'permission_required'));
test('cannot smuggle database column', fn()=>rejects(fn()=>save_user_account($pdo,['password_hash'=>'bad'],false),422,'invalid_argument'));
test('cannot update someone else', fn()=>rejects(fn()=>save_user_account($pdo,['userId'=>2,'firstName'=>'No'],false),403,'permission_required'));
$GLOBALS['actorId']=3;
test('editor updates ordinary account', fn()=>expect(save_user_account($pdo,['userId'=>1,'lastName'=>'Changed'],false)['last_name']==='Changed'));
test('editor cannot reset superuser password', fn()=>rejects(fn()=>save_user_account($pdo,['userId'=>4,'password'=>'replacement'],false),403,'permission_required'));
$GLOBALS['actorId']=4;
test('superuser grants permissions', fn()=>expect(save_user_account($pdo,['userId'=>1,'permissions'=>3],false)['permissions']===3));
test('superuser revokes permissions', fn()=>expect(save_user_account($pdo,['userId'=>1,'permissions'=>0],false)['permissions']===0));
test('unknown user', fn()=>rejects(fn()=>save_user_account($pdo,['userId'=>999,'firstName'=>'No'],false),404,'user_not_found'));
test('empty patch', fn()=>rejects(fn()=>save_user_account($pdo,[],false),422,'invalid_argument'));
test('empty password', fn()=>rejects(fn()=>account_fields(['password'=>''],false),422,'invalid_argument'));
test('bcrypt byte limit', fn()=>rejects(fn()=>account_fields(['password'=>str_repeat('a',73)],false),422,'invalid_argument'));
test('Unicode character limits', fn()=>expect(strlen(account_fields(['firstName'=>str_repeat('é',100)],false)['first_name'])===200));
test('name too long', fn()=>rejects(fn()=>account_fields(['firstName'=>str_repeat('a',101)],false),422,'invalid_argument'));
test('clear preferred name', fn()=>expect(account_fields(['preferredName'=>null],false)['preferred_name']===null));
echo $passed . " tests passed." . PHP_EOL;
