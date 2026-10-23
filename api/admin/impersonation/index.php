<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/_core/bootstrap.php';
if (empty($_SERVER['HTTPS']) || strtolower((string)$_SERVER['HTTPS']) === 'off')
    api_error('HTTPS is required.',403,'https_required');
$method = require_method('GET','POST');
if ($method === 'GET') {
    json_response(['user'=>optional_current_user(), 'impersonation'=>$_SESSION['impersonation'] ?? null, 'csrfToken'=>csrf_token()]);
}
require_csrf();
$input = json_input();
if (($input['action'] ?? '') === 'return') {
    $user = impersonation_return(db());
    json_response(['user'=>$user,'csrfToken'=>csrf_token(),'impersonating'=>false]);
}
if (($input['action'] ?? '') !== 'start') api_error('Unknown impersonation action.',422,'invalid_action');
$actor = require_permission(PERMISSION_IMPERSONATE);
$pdo = db();
$pdo->beginTransaction();
try {
    // Lock and recheck the operator together with the target.
    $actor = find_user_account($pdo,(int)$actor['id'],true);
    $target = isset($input['targetUserId']) ? find_user_account($pdo,require_positive_int($input,'targetUserId'),true) : null;
    if ($target === null) {
        $query = $pdo->prepare('SELECT id,first_name,last_name,preferred_name,username,permissions FROM users WHERE username=:username LIMIT 1 FOR UPDATE');
        $query->execute([':username'=>require_string($input,'targetUsername')]);
        $target = $query->fetch();
        if (!$target) {$pdo->rollBack();api_error('User was not found.',404,'user_not_found');}
    }
    $metadata = impersonation_record_start($pdo,$target,['mode'=>'session','user'=>$actor,'permissions'=>(int)$actor['permissions']]);
    $pdo->commit();
} catch (Throwable $error) {if ($pdo->inTransaction()) $pdo->rollBack();throw $error;}
impersonation_replace_session((int)$target['id'],$metadata);
json_response(['user'=>current_user(),'csrfToken'=>csrf_token(),'impersonating'=>true]);
