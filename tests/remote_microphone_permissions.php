<?php
function live_ws_can_view($user) {return ($user['permissions'] ?? 0) & 64;}
function live_ws_send_error($client,$requestId,$code,$message) {$GLOBALS['sent'][]=['error'=>$code];}
function live_ws_send($client,$message) {$GLOBALS['sent'][]=$message;}
function live_ws_send_response($client,$requestId,$message) {$GLOBALS['sent'][]=$message;}
$source=file_get_contents(__DIR__.'/../services/live-stream-websocket.php');
$start=strpos($source,"    if (\$type === 'trainer.microphone') {");
$end=strpos($source,"    if (\$type === 'trainer.tts') {",$start);
if ($start===false || $end===false) throw new Exception('handler absent');
eval('function handle($user,$message,$peers,$clients){$type="trainer.microphone";$client=[];$clientId=7;$requestId="test";'.substr($source,$start,$end-$start).'}');
$peer=['viewerClientId'=>7,'targetUserId'=>2,'publisherClientId'=>8];
$message=['peerId'=>1,'targetUserId'=>2,'enabled'=>false,'commandId'=>'test-123'];
function check($permission,$message,$peer,$clients,$expected) {
 $GLOBALS['sent']=[];handle(['permissions'=>$permission],$message,[1=>$peer],$clients);
 $first=$GLOBALS['sent'][0]??[];
 if(($first['error']??$first['type']??null)!==$expected) throw new Exception('unexpected '.json_encode($GLOBALS['sent']));
}
check(64,$message,$peer,[8=>[]],'trainer.microphone');
check(0,$message,$peer,[8=>[]],'permission_required');
check(64,$message,array_replace($peer,['viewerClientId'=>9]),[8=>[]],'permission_required');
check(64,array_replace($message,['targetUserId'=>3]),$peer,[8=>[]],'permission_required');
check(64,array_replace($message,['enabled'=>'false']),$peer,[8=>[]],'invalid_argument');
check(64,array_replace($message,['commandId'=>[]]),$peer,[8=>[]],'invalid_argument');
check(64,$message,$peer,[],'live_stream_not_found');
echo "PASS remote mic permission, peer ownership, target isolation, payload validation and unavailable publisher\n";
