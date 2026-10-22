<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/_core/bootstrap.php';
require_once dirname(__DIR__,2).'/_core/speech_recordings.php';
if (empty($_SERVER['HTTPS']) || strtolower((string)$_SERVER['HTTPS'])==='off') api_error('HTTPS is required.',403,'https_required');
$method=require_method('GET','POST');
$bearer=access_token_bearer();
$authorization=$bearer!==null && access_token_query_value()===null
    ? consume_access_token($bearer,[PERMISSION_DEVELOPER],ACCESS_TOKEN_SCOPE_DIAGNOSTICS,true,'token_bearer')
    : authorize_guarded_access([PERMISSION_DEVELOPER],ACCESS_TOKEN_SCOPE_DIAGNOSTICS);
if ($method==='POST' && guarded_access_requires_csrf($authorization)) require_csrf();
if ((int)($_SERVER['CONTENT_LENGTH']??0)>1500000) api_error('Recording exceeds the upload limit.',413,'recording_too_large');
header('Cache-Control: private, no-store');header('Referrer-Policy: no-referrer');
$store=new SpeechRecordings('/var/lib/clocktimer/diagnostics/recordings',dirname(__DIR__,3).'/tests/recording-scripts');
try {
    if ($method==='POST') json_response(['recording'=>$store->save(json_input()),'csrfToken'=>csrf_token()]);
    $locale=(string)($_GET['locale']??'en-US');$delivery=(string)($_GET['delivery']??'fast');
    if (isset($_GET['audio'])) {
        $wav=$store->audio($locale,$delivery,(string)$_GET['audio']);
        header('Content-Type: audio/wav');header('Content-Length: '.strlen($wav));header('X-Content-Type-Options: nosniff');
        session_write_close();echo $wav;exit;
    }
    json_response($store->script($locale,$delivery)+['csrfToken'=>csrf_token()]);
} catch (InvalidArgumentException $error) {api_error($error->getMessage(),422,'invalid_recording');}
catch (RuntimeException $error) {api_error($error->getMessage(),503,'recording_unavailable');}
