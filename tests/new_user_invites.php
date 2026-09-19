<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_core/new_user_invites.php';
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE new_tokens(token_hash TEXT PRIMARY KEY,admin_user_id INTEGER NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL)');
function check_invite(bool $value,string $name):void{if(!$value)throw new RuntimeException($name);echo "PASS $name\n";}
$token=create_new_user_token($pdo,7,1000);$row=$pdo->query('SELECT * FROM new_tokens')->fetch();
check_invite(strlen($token)===64&&$row['token_hash']!==$token,'raw invitation token is not stored');
check_invite((int)$row['expires_at']===1900,'invitation expires after fifteen minutes');
$renewed=renew_or_create_new_user_token($pdo,7,$token,1200);$row=$pdo->query('SELECT * FROM new_tokens')->fetch();
check_invite($renewed===$token&&(int)$row['expires_at']===2100,'regenerate renews an existing token');
$grant=consume_new_user_token($pdo,$token,1300);check_invite($grant['adminUserId']===7&&(int)$pdo->query('SELECT COUNT(*) FROM new_tokens')->fetchColumn()===0,'first access consumes the token');
check_invite(consume_new_user_token($pdo,$token,1301)===null,'consumed token cannot be reused');
$replacement=renew_or_create_new_user_token($pdo,7,$token,1400);check_invite($replacement!==$token,'regenerate replaces a consumed token');
check_invite(consume_new_user_token($pdo,$replacement,2301)===null,'expired token cannot be consumed');
