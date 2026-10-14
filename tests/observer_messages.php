<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_core/observer_messages.php';
function expect(bool $value): void {if(!$value)throw new RuntimeException('Assertion failed');}
expect(observer_message_text('Literal \\[first] and [first]', ['first_name'=>'Jane'])==='Literal [first] and Jane');
$person=['first_name'=>'Jane','middle_name'=>null,'last_name'=>'Doe','preferred_name'=>'J'];
expect(observer_message_text('Hello [first last] / [preferred]',$person)==='Hello Jane Doe / J');
expect(observer_message_text('[last first middle]',$person)==='Doe Jane');
expect(observer_message_text('[urgent] [FIRST]',$person)==='[urgent] Jane');
expect(observer_message_text('[preferred]',[])==='');
expect(observer_message_text('[preferred last]', ['first_name'=>'Jane','last_name'=>'Doe'])==='Jane Doe');
expect(observer_message_text('[preferred]', ['first_name'=>'Jane','preferred_name'=>'  '])==='Jane');
function live_ws_can_view($user){return (bool)($user['permissions']&64);}
function live_ws_target_client($clients,$id){foreach($clients as $key=>$client)if(($client['available']??false)&&($client['user']['id']??0)===$id)return $key;return null;}
function live_ws_current_user($pdo,&$client){return $client['user']??null;}
function live_ws_send_error($client,$requestId,$code,$message){$GLOBALS['output'][]=['error'=>$code];}
function live_ws_send_response($client,$requestId,$payload){$GLOBALS['result']=$payload;}
function live_ws_send($client,$payload){$GLOBALS['output'][]=['target'=>$client['user']['id'],'payload'=>$payload];}
$source=file_get_contents(__DIR__.'/../services/live-stream-websocket.php');
$start=strpos($source,"    if (\$type === 'trainer.tts.batch') {");
$end=strpos($source,"    if (\$type === 'trainer.tts') {",$start);
eval('function batch($user,$message,$clients){$type="trainer.tts.batch";$pdo=null;$client=[];$requestId="test";'.substr($source,$start,$end-$start).'}');
$clients=[2=>['available'=>true,'user'=>['id'=>2]+$person],3=>['available'=>true,'user'=>['id'=>3,'first_name'=>'Bob','middle_name'=>'A','last_name'=>'Smith','preferred_name'=>'Bobby']]];
$actor=['id'=>1,'permissions'=>64];
function run_batch($actor,$message,$clients){$GLOBALS['output']=[];$GLOBALS['result']=null;batch($actor,$message,$clients);}
run_batch($actor,['targetUserIds'=>[2,3,4,2],'text'=>'Hi [preferred last]'],$clients);
expect($GLOBALS['result']['sentUserIds']===[2,3]);expect($GLOBALS['result']['failures']===[['userId'=>4,'code'=>'live_stream_not_found']]);
expect(count($GLOBALS['output'])===2);expect($GLOBALS['output'][0]['payload']['text']==='Hi J Doe');expect($GLOBALS['output'][1]['payload']['text']==='Hi Bobby Smith');
run_batch(['id'=>1,'permissions'=>0],['targetUserIds'=>[2],'text'=>'Hi'],$clients);expect($GLOBALS['output']===[['error'=>'permission_required']]);
run_batch($actor,['targetUserIds'=>[1],'text'=>'Hi'],$clients);expect($GLOBALS['result']['sentUserIds']===[]);
run_batch($actor,['targetUserIds'=>[2,-1],'text'=>'Hi'],$clients);expect($GLOBALS['output']===[['error'=>'invalid_argument']]);
run_batch($actor,['targetUserIds'=>array_fill(0,51,2),'text'=>'Hi'],$clients);expect($GLOBALS['output']===[['error'=>'invalid_argument']]);
run_batch($actor,['targetUserIds'=>[2],'text'=>str_repeat('[first]',72)],$clients);expect($GLOBALS['output']===[['error'=>'invalid_argument']]);
$long=$clients;$long[2]['user']['first_name']=str_repeat('é',100);
run_batch($actor,['targetUserIds'=>[2,3],'text'=>str_repeat('[first] ',6)],$long);expect($GLOBALS['result']['sentUserIds']===[3]);expect($GLOBALS['result']['failures']===[['userId'=>2,'code'=>'invalid_argument']]);
run_batch($actor,['targetUserIds'=>[2],'text'=>"\xFF"],$clients);expect($GLOBALS['output']===[['error'=>'invalid_argument']]);
echo "PASS ordered names, empty fields, private per-recipient expansion, batch authorization, validation, deduplication and partial delivery\n";
