<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2).'/_core/bootstrap.php';
require_once dirname(__DIR__, 2).'/_core/speech_sessions.php';
$method = require_method('GET', 'POST');
$config = speech_service_config();
// No wildcard CORS: local test pages use their own same-origin PHP proxy/config.
if (isset($_SERVER['HTTP_ORIGIN']) && !in_array($_SERVER['HTTP_ORIGIN'], $config['origins'], true))
    api_error('This origin cannot use speech recognition.', 403, 'origin_denied');
if ($method === 'GET') json_response(['protocol'=>1, 'languages'=>array_keys($config['models']), 'csrfToken'=>csrf_token()]);
require_csrf();
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 1024) api_error('Request too large.', 413, 'invalid_request');
$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if (!in_array($origin, $config['origins'], true)) api_error('A permitted origin is required.', 403, 'origin_denied');
$language = speech_language(json_input()['language'] ?? null, $config['models']);
speech_check_rate((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
// Anonymous grants intentionally permit voice login, but confer no account permissions.
$userId = filter_var($_SESSION['user_id'] ?? null, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]);
$authenticated = $userId !== false;
$subject = $authenticated ? 'user:'.$userId : 'anonymous:'.session_id().':'.($_SERVER['REMOTE_ADDR'] ?? '');
$grant = speech_issue_ticket($config, $origin, $language, $subject, null, $authenticated);
session_write_close();
json_response($grant+['language'=>$language, 'authenticated'=>$authenticated, 'sampleRate'=>16000, 'format'=>'pcm_s16le', 'websocketPath'=>'/speech-ws']);
