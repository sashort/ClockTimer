<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/_core/permissions.php';
// Load the service's actual protocol functions without starting a server or
// opening the application database. Every client socket below is in memory.
$source = file_get_contents(__DIR__ . '/../services/live-stream-websocket.php');
$source = substr($source, strpos($source, 'function live_ws_now'));
$source = strstr($source, '$pdo = db();', true);
eval($source);
function check(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
function messages(array &$client): array {
    $socket=$client['socket']; rewind($socket); $data=stream_get_contents($socket); ftruncate($socket,0); rewind($socket);
    $result=[];
    while ($data !== '') {
        $length=ord($data[1]) & 127; $head=2;
        if ($length===126) { $length=unpack('n',substr($data,2,2))[1]; $head=4; }
        $result[]=json_decode(substr($data,$head,$length),true,512,JSON_THROW_ON_ERROR);
        $data=substr($data,$head+$length);
    }
    return $result;
}
function client(int $id,int $permissions): array {
    return ['socket'=>fopen('php://temp','w+'),'user'=>['id'=>$id,'permissions'=>$permissions],
        'available'=>true,'handshake'=>true,'connected_at'=>microtime(true)];
}
$pdo=new PDO('sqlite::memory:'); $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);
$pdo->exec('CREATE TABLE users(id INTEGER,username TEXT,first_name TEXT,middle_name TEXT,last_name TEXT,preferred_name TEXT,permissions INTEGER)');
foreach ([1=>64,2=>0,3=>80,4=>16] as $id=>$permissions) $pdo->exec("INSERT INTO users VALUES($id,'test$id','','','','',$permissions)");
$clients=[1=>client(1,64),2=>client(2,0),3=>client(3,80),4=>client(4,16)]; $peers=[]; $next=1;
$join=['type'=>'peer.join','requestId'=>1,'targetUserId'=>2,'offer'=>['type'=>'offer','sdp'=>'test'],'debugSpeech'=>true];
live_ws_handle_message(1,$join,$pdo,$clients,$peers,$next);
check(messages($clients[1])[0]['error']==='permission_required','ordinary trainer cannot enable debugging');
live_ws_handle_message(4,$join,$pdo,$clients,$peers,$next);
check(messages($clients[4])[0]['error']==='permission_required','developer still needs Drop-In permission');
check(count($peers)===0,'denied requests create no peer');
live_ws_handle_message(3,$join,$pdo,$clients,$peers,$next);
check(count($peers)===1 && $peers[1]['debugSpeech']===true,'developer with Drop-In may subscribe');
$publisher=messages($clients[2]);
check($publisher[1]['type']==='speech.debug.subscription' && $publisher[1]['enabled']===true,'publisher receives subscription');
messages($clients[3]);
$ordinary=$join; $ordinary['debugSpeech']=false;
live_ws_handle_message(1,$ordinary,$pdo,$clients,$peers,$next);
messages($clients[1]); messages($clients[2]);
live_ws_handle_message(2,['type'=>'publisher.event','eventType'=>'speech.debug','payload'=>['transcript'=>'four twelve']],$pdo,$clients,$peers,$next);
check(count(messages($clients[3]))===1,'debug peer receives diagnostics');
check(messages($clients[1])===[],'normal peer receives no debug transcript');
live_ws_handle_message(2,['type'=>'publisher.event','eventType'=>'speech.command','payload'=>['transcript'=>'ready']],$pdo,$clients,$peers,$next);
check(count(messages($clients[3]))===1 && count(messages($clients[1]))===1,'normal command events remain available');
live_ws_close_peer(1,$peers,$clients);
$publisher=messages($clients[2]);
check(end($publisher)['enabled']===false,'last debug disconnect disables publication even with a normal viewer');
check(count($peers)===1,'ordinary viewer remains connected');
check(live_ws_can_debug(['permissions'=>PERMISSION_SUPERUSER]),'superuser qualifies');
echo "PASS authenticated debug joins, permission denial, isolated routing, normal viewer compatibility and disconnect cleanup\n";
