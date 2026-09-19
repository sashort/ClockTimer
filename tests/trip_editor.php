<?php
declare(strict_types=1);
require __DIR__.'/../api/_core/trip_editor.php';
$checks=0;
function check(bool $condition,string $name):void{global $checks;if(!$condition)throw new RuntimeException($name);$checks++;echo "PASS $name\n";}
function rejects(callable $action,string $name):void{try{$action();}catch(InvalidArgumentException){check(true,$name);return;}check(false,$name);}
$events=[
 ['id'=>1,'event'=>'trip.started','timestamp'=>'2026-09-18 12:00:00.000','value'=>['standardTime'=>'20:00','creationTime'=>'11:00:00','scheduledStart'=>'12:00:00','startTime'=>'12:00:00','creationAnchor'=>'2026-09-18T00:00:00Z','nonProduction'=>false]],
 ['id'=>2,'event'=>'interval.started','timestamp'=>'2026-09-18 12:05:00.000','value'=>['intervalKey'=>'break1','type'=>'break','length'=>'2:00','attributes'=>[]]],
 ['id'=>3,'event'=>'interval.ended','timestamp'=>'2026-09-18 12:07:00.000','value'=>['intervalKey'=>'break1']],
 ['id'=>4,'event'=>'trip.stopped','timestamp'=>'2026-09-18 12:20:00.000','value'=>[]],
];
$a=trip_edit_aggregate($events);check($a['standard']===1200000,'existing m:ss standard duration remains editable');check($a['counted']===1080000,'counted aggregate excludes the break');
$edited=trip_edit_apply($events,['operation'=>'entry','entry'=>['intervalKey'=>'break1','type'=>'break','start'=>'2026-09-18T12:04:00Z','end'=>'2026-09-18T12:08:00Z','length'=>'0:04:00']]);
check(trip_edit_aggregate($edited)['counted']===960000,'interval editing recalculates counted time');check(array_column($edited,'id')===[1,2,3,4],'editing keeps existing event IDs');
$removed=trip_edit_apply($events,['operation'=>'delete-entry','entry'=>['intervalKey'=>'break1']]);check(count($removed)===2,'removal deletes both interval boundaries');check(trip_edit_aggregate($removed)['counted']===1200000,'removal recalculates aggregate');
$added=trip_edit_apply($events,['operation'=>'add-entry','entry'=>['type'=>'down','start'=>'2026-09-18T12:10:00Z','end'=>'2026-09-18T12:12:00Z','length'=>'0:02:00']]);check(count($added)===6,'adding creates paired interval events');check(trip_edit_aggregate($added)['counted']===960000,'adding a down entry updates aggregates');
$batch=trip_edit_apply($events,['operation'=>'entries','changes'=>[
 ['operation'=>'delete-entry','entry'=>['intervalKey'=>'break1']],
 ['operation'=>'add-entry','entry'=>['type'=>'down','start'=>'2026-09-18T12:10:00Z','end'=>'2026-09-18T12:12:00Z','length'=>'0:02:00']]
]]);check(count($batch)===4,'entry batch applies additions and removals together');check(trip_edit_aggregate($batch)['counted']===1080000,'entry batch validates its final aggregate');
$settings=trip_edit_settings($events);$settings['scheduledStart']='11:59:00';$settings['nonProduction']=true;$settings['standardTime']='0:30:00';
$changed=trip_edit_apply($events,['operation'=>'settings','settings'=>$settings]);$a=trip_edit_aggregate($changed);
check($a['startTime']==='2026-09-18 11:59:00','scheduled start contributes to elapsed start');check($a['nonProduction']===1&&$a['standard']===1800000,'settings edits persist production and standard duration');
check(trip_edit_revision($events)!==trip_edit_revision($changed),'revision changes when content changes');
rejects(fn()=>trip_edit_apply($events,['operation'=>'entry','entry'=>['intervalKey'=>'break1','type'=>'break','start'=>'2026-09-18T12:10:00Z','end'=>'2026-09-18T12:08:00Z']]),'rejects reversed interval');
rejects(fn()=>trip_edit_apply($events,['operation'=>'add-entry','entry'=>['type'=>'break','start'=>'2026-09-18T11:00:00Z','end'=>'2026-09-18T12:00:00Z']]),'rejects entry outside trip');
rejects(fn()=>trip_edit_apply($events,['operation'=>'delete-entry','entry'=>['eventId'=>1]]),'trip boundary cannot be removed');
rejects(fn()=>trip_edit_duration('0:00:00'),'rejects zero standard duration');
rejects(fn()=>trip_edit_apply($events,['operation'=>'add-entry','entry'=>['type'=>'down','start'=>'2026-09-18T12:06:00Z','end'=>'2026-09-18T12:08:00Z']]),'rejects overlapping entries that cannot be replayed');
rejects(fn()=>trip_edit_apply($events,['operation'=>'entries','changes'=>[['operation'=>'add-entry','entry'=>['type'=>'down','start'=>'2026-09-18T12:06:00Z','end'=>'2026-09-18T12:08:00Z']]]]),'rejects an invalid final entry batch');
echo "$checks trip editor checks passed.\n";
