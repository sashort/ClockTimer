<?php
declare(strict_types=1);
function api_error(string $message, int $status=400, string $code='bad_request'): never {throw new RuntimeException($code);}
require_once dirname(__DIR__).'/api/_core/speech_sessions.php';
$config=['secret'=>str_repeat('a',64),'models'=>['en-US'=>'english','fr-FR'=>'french']];
if (speech_language('EN-us',$config['models']) !== 'en-US') throw new RuntimeException('Canonical locale');
if (speech_language('fr-FR',$config['models']) !== 'fr-FR') throw new RuntimeException('French route');
foreach (['en','de-DE','../../en-US',null] as $bad) {
    try {speech_language($bad,$config['models']);throw new LogicException('Unsupported locale accepted');}
    catch (RuntimeException $e) {if ($e->getMessage() !== 'unsupported_language') throw $e;}
}
$grant=speech_issue_ticket($config,'https://wmof.sashort-apps.com','en-US','anonymous-session',1700000000);
[$encoded,$signature]=explode('.',$grant['ticket']);
if (!hash_equals(hash_hmac('sha256',$encoded,$config['secret']),$signature)) throw new RuntimeException('Ticket signature');
$payload=json_decode(base64_decode(strtr($encoded,'-_','+/')),true,16,JSON_THROW_ON_ERROR);
if ($payload['language'] !== 'en-US' || $payload['exp'] !== 1700000060 || str_contains(json_encode($payload),'anonymous-session')) throw new RuntimeException('Ticket claims');
if ($payload['authenticated'] !== false) throw new RuntimeException('Anonymous grant');
$auth=speech_issue_ticket($config,'https://wmof.sashort-apps.com','en-US','user:123',1700000000,true);
$authPayload=json_decode(base64_decode(strtr(explode('.',$auth['ticket'])[0],'-_','+/')),true);
if ($authPayload['authenticated'] !== true) throw new RuntimeException('Authenticated grant');
echo "PASS language routing and signed anonymous voice-login grants\n";
