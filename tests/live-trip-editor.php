<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_core/trip_editor.php';
function verify_live(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);echo "PASS $message\n";}
$now=(int)floor(microtime(true)*1000);$anchor=trip_storage_instant('1970-01-01 00:00:00.000',$now-600000);
$start=['id'=>1,'event'=>'trip.started','timestamp'=>$anchor,'scheduledStartTime'=>str_replace(' ','T',$anchor).'Z','value'=>['timelineVersion'=>2,'creationOffsetMilliseconds'=>0,'scheduledStartOffsetMilliseconds'=>0,'startOffsetMilliseconds'=>0,'standardTimeMilliseconds'=>1800000,'nonProduction'=>false]];
foreach(['break','down'] as $type){
 $events=[$start,['id'=>2,'event'=>'interval.started','timestamp'=>trip_storage_instant($anchor,480000),'value'=>['intervalKey'=>'active','type'=>$type,'length'=>$type==='break'?300000:null,'startBuffer'=>30000,'endBuffer'=>30000,'attributes'=>['breakType'=>'short','custom'=>'retained','clock-timer-scheduled-end'=>'2030-01-01T00:00:00Z','clock-timer-actual-end-offset-ms'=>999999]]],['id'=>3,'event'=>'interval.elapsed','timestamp'=>trip_storage_instant($anchor,490000),'value'=>['intervalKey'=>'active','behavior'=>'startLatency']]];
 $changed=trip_edit_apply($events,['operation'=>'entry','entry'=>['intervalKey'=>'active','type'=>$type,'start'=>str_replace(' ','T',trip_storage_instant($anchor,420000)).'Z','length'=>$type==='break'?1000:null]]);
 verify_live(!array_filter($changed,static fn($e)=>$e['event']==='interval.elapsed'),'edited '.$type.' discards stale derived elapsed boundaries');
 $v=$changed[1]['value'];verify_live($v['attributes']['custom']==='retained'&&!array_filter(array_keys($v['attributes']),static fn($key)=>str_starts_with($key,'clock-timer-')),'edited '.$type.' keeps custom attributes while rebuilding cached phase data');
 if($type==='down')verify_live($v['length']===null&&$v['startBuffer']===null&&$v['endBuffer']===null,'Down remains open-ended without break buffers');
 $deleted=trip_edit_apply($events,['operation'=>'delete-entry','entry'=>['intervalKey'=>'active']]);verify_live(count($deleted)===1,'deleting an active interval removes its derived boundaries too');
}
