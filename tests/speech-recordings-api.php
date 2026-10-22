<?php
declare(strict_types=1);
/** Execute the production route in isolated PHP requests without a live database or upload. */
function recordingRequest(string $setup): array {
    $root=var_export(dirname(__DIR__),true);
    $code="\$_SERVER['HTTPS']='on'; \$_SERVER['REQUEST_METHOD']='GET'; require $root.'/api/_core/bootstrap.php'; \$_SESSION=[]; ".$setup."; require $root.'/api/diagnostics/recordings/index.php';";
    $process=proc_open([PHP_BINARY,'-r',$code],[1=>['pipe','w'],2=>['pipe','w']],$pipes);
    $body=stream_get_contents($pipes[1]);$errors=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);
    if(proc_close($process)!==0 || $errors!=='')throw new RuntimeException('Route failed: '.$errors);
    return json_decode($body,true,32,JSON_THROW_ON_ERROR);
}
function checkRecordingResponse(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
$grant="\$_SESSION['access_token_grants'][ACCESS_TOKEN_SCOPE_DIAGNOSTICS]=['token_id'=>1,'owner_user_id'=>null,'permissions'=>PERMISSION_DEVELOPER,'expires_at'=>time()+60,'requires_authentication'=>false,'principal_key'=>'fixture'];";
checkRecordingResponse(recordingRequest("\$_SERVER['HTTPS']='off'")['error']==='https_required','HTTPS is mandatory');
checkRecordingResponse(recordingRequest('')['error']==='unauthorized','Anonymous requests are rejected');
checkRecordingResponse(recordingRequest($grant."\$_SERVER['REQUEST_METHOD']='POST'")['error']==='invalid_csrf','A scoped browser grant still requires CSRF for uploads');
$result=recordingRequest($grant);
checkRecordingResponse(count($result['prompts'])===31 && strlen($result['csrfToken'])>=32,'Scoped GET returns script and CSRF');
checkRecordingResponse(recordingRequest($grant."\$_GET['locale']='../private'")['error']==='invalid_recording','Path traversal is rejected');
checkRecordingResponse(recordingRequest($grant."\$_SERVER['REQUEST_METHOD']='DELETE'")['error']==='method_not_allowed','Unsupported methods are rejected');
echo "PASS production recording route HTTPS, anonymous denial, scoped script, CSRF, locale and method guards\n";

