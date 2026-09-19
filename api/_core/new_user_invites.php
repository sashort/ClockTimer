<?php
declare(strict_types=1);

const NEW_USER_TOKEN_TTL = 900;

function create_new_user_token(PDO $pdo, int $adminUserId, ?int $now=null): string
{
    $now ??= time();
    $pdo->prepare('DELETE FROM new_tokens WHERE expires_at <= :now OR admin_user_id = :admin')->execute([':now'=>$now,':admin'=>$adminUserId]);
    $token=bin2hex(random_bytes(32));
    $pdo->prepare('INSERT INTO new_tokens (token_hash, admin_user_id, created_at, expires_at) VALUES (:hash,:admin,:created,:expires)')
        ->execute([':hash'=>hash('sha256',$token),':admin'=>$adminUserId,':created'=>$now,':expires'=>$now+NEW_USER_TOKEN_TTL]);
    return $token;
}

function renew_or_create_new_user_token(PDO $pdo, int $adminUserId, string $token, ?int $now=null): string
{
    $now??=time();$hash=preg_match('/^[a-f0-9]{64}$/D',$token)?hash('sha256',$token):'';
    if($hash!==''){$update=$pdo->prepare('UPDATE new_tokens SET created_at=:now, expires_at=:expires WHERE token_hash=:hash AND admin_user_id=:admin');$update->execute([':now'=>$now,':expires'=>$now+NEW_USER_TOKEN_TTL,':hash'=>$hash,':admin'=>$adminUserId]);if($update->rowCount()===1)return $token;}
    return create_new_user_token($pdo,$adminUserId,$now);
}

function consume_new_user_token(PDO $pdo, string $token, ?int $now=null): ?array
{
    if (!preg_match('/^[a-f0-9]{64}$/D',$token)) return null;
    $now ??= time();$hash=hash('sha256',$token);
    $pdo->beginTransaction();
    try {
        $find=$pdo->prepare('SELECT admin_user_id, expires_at FROM new_tokens WHERE token_hash=:hash');$find->execute([':hash'=>$hash]);$record=$find->fetch();
        $pdo->prepare('DELETE FROM new_tokens WHERE token_hash=:hash OR expires_at <= :now')->execute([':hash'=>$hash,':now'=>$now]);
        $pdo->commit();
        if(!$record || (int)$record['expires_at'] <= $now) return null;
        return ['adminUserId'=>(int)$record['admin_user_id'],'expiresAt'=>(int)$record['expires_at']];
    } catch(Throwable $error) {if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

function create_invited_user(PDO $pdo, int $adminUserId, array $input): array
{
    $actor=find_user_account($pdo,$adminUserId);
    if(!has_permission($actor,PERMISSION_CREATE_USERS)) api_error('This invitation is no longer authorized.',403,'permission_required');
    $fields=account_fields($input,true);$fields['permissions']=0;$parameters=[];
    foreach($fields as $column=>$value)$parameters[':'.$column]=$value;
    $changeId=uuid_v4();
    try {
        $pdo->beginTransaction();
        $pdo->prepare('SET @audit_user_id=:user, @audit_change_id=:change, @audit_sequence=0, @audit_reversal_of=NULL')->execute([':user'=>$adminUserId,':change'=>$changeId]);
        $pdo->prepare('INSERT INTO users ('.implode(', ',array_keys($fields)).') VALUES ('.implode(', ',array_keys($parameters)).')')->execute($parameters);
        $id=(int)$pdo->lastInsertId();$pdo->commit();clear_audit_context($pdo);return find_user_account($pdo,$id);
    } catch(PDOException $error) {
        if($pdo->inTransaction())$pdo->rollBack();clear_audit_context($pdo);
        if(($error->errorInfo[1]??null)===1062)api_error('That username is already in use.',409,'username_conflict');
        throw $error;
    } catch(Throwable $error) {if($pdo->inTransaction())$pdo->rollBack();clear_audit_context($pdo);throw $error;}
}
