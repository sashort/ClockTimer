<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_core/trip_editor.php';
function editor_check(bool $condition,string $message):void {if(!$condition)throw new RuntimeException($message);echo "PASS $message\n";}
$events=[
 ['id'=>1,'event'=>'trip.started','timestamp'=>'2026-11-03 10:00:00.125','value'=>['creationAnchor'=>'2026-11-03T00:00:00.000Z','creationTime'=>'10:00:00.125','scheduledStart'=>'10:00:00.125','startTime'=>'10:00:00.125','standardTimeMilliseconds'=>1800000,'nonProduction'=>false]],
 ['id'=>2,'event'=>'interval.started','timestamp'=>'2026-11-03 10:05:00.125','value'=>['type'=>'break','length'=>300000,'intervalKey'=>'b']],
 ['id'=>3,'event'=>'interval.ended','timestamp'=>'2026-11-03 10:10:00.125','value'=>['intervalKey'=>'b']],
 ['id'=>4,'event'=>'interval.started','timestamp'=>'2026-11-03 10:15:00.125','value'=>['type'=>'down','intervalKey'=>'d','approvalState'=>'pending']],
 ['id'=>5,'event'=>'interval.ended','timestamp'=>'2026-11-03 10:19:00.125','value'=>['intervalKey'=>'d']],
 ['id'=>6,'event'=>'trip.stopped','timestamp'=>'2026-11-03 10:40:00.125','value'=>[]]
];
$original=json_encode($events);$settings=trip_edit_api_settings($events);$settings['standardTimeMilliseconds']=2400000;
trip_edit_validate_command($events,['operation'=>'editor-preview','changes'=>[],'tripId'=>41]);
editor_check(json_encode($events)===$original,'command preflight accepts an unchanged preview without mutation');
$change=['operation'=>'editor','settings'=>$settings,'changes'=>[['operation'=>'entry','entry'=>['eventId'=>4,'intervalKey'=>'d','start'=>'2026-11-03T10:15:00.125Z','end'=>'2026-11-03T10:19:00.125Z','type'=>'down','approvedTime'=>120000,'approvalState'=>'approved']]],'official'=>[['operation'=>'official-percent','percentTenths'=>1200,'showOfficialStart'=>true]],'_actorId'=>2];
$preview=trip_edit_preview($events,$change,41);$saved=trip_edit_apply($events,$change);
editor_check($preview['standardTimeMilliseconds']===2400000,'preview combines Details and Timeline');
editor_check(abs($preview['officialCorrection']['percent']-120)<1e-8,'official percentage applied after combined changes');
editor_check($preview['officialCorrection']['startTime']!==null,'derived Official Start included in preview');
editor_check(json_encode($events)===$original,'preview leaves factual source events unchanged');
editor_check(trip_edit_aggregate($saved)['standard']===2400000,'combined Save retains Standard edit');
editor_check(trip_edit_settings($saved)['startTime']==='10:00:00.125','combined edit preserves actual start milliseconds');
$invalid=$change;$invalid['changes'][]=['operation'=>'add-entry','entry'=>['type'=>'down','start'=>'2026-11-03T10:06:00Z','end'=>'2026-11-03T10:08:00Z']];
try{trip_edit_apply($events,$invalid);throw new RuntimeException('Invalid batch accepted');}catch(InvalidArgumentException $e){editor_check(str_contains($e->getMessage(),'overlap'),'invalid timeline rejects the entire settings/entries batch');}
editor_check(json_encode($events)===$original,'rejected combined save does not mutate input');
$active=array_values(array_filter($events,static fn($e)=>$e['event']!=='trip.stopped'));
$activePreview=trip_edit_preview($active,['changes'=>[]],41);editor_check($activePreview['running']===true,'active preview retains running status');
$scheduled=$settings;$scheduled['instants']['scheduledStart']='2026-11-03T09:55:00.125Z';
$rebased=trip_edit_apply($events,['operation'=>'editor','settings'=>$scheduled,'changes'=>[]]);
editor_check(array_values(array_filter($rebased,static fn($e)=>$e['event']==='interval.started'))[0]['timestamp']===$events[1]['timestamp'],'scheduled start edit preserves interval instants');

$removed=trip_edit_apply($events,['operation'=>'editor','changes'=>[['operation'=>'delete-entry','entry'=>['eventId'=>4,'intervalKey'=>'d']]]]);
editor_check(count(array_filter($removed,static fn($e)=>($e['value']['intervalKey']??null)==='d'))===0,'Down deletion removes all interval events');
$plan=trip_edit_persistence_plan($events,$removed);editor_check(in_array(4,$plan['delete'],true)&&in_array(5,$plan['delete'],true),'Down deletion includes both stored boundaries');

$migrated=$events;$migrated[0]['scheduledStartTime']='2026-11-03T10:00:00.125Z';$migrated[0]['value']=['timelineVersion'=>2,'creationOffsetMilliseconds'=>'0','scheduledStartOffsetMilliseconds'=>0,'startOffsetMilliseconds'=>0,'standardTimeMilliseconds'=>1800000,'nonProduction'=>false];
$migratedSettings=trip_edit_api_settings($migrated);editor_check($migratedSettings['instants']['scheduledStart']==='2026-11-03T10:00:00.125Z','string-zero migrated creation offset does not hide scheduled start');
$migratedSaved=trip_edit_apply($migrated,['operation'=>'editor','changes'=>[['operation'=>'delete-entry','entry'=>['eventId'=>4,'intervalKey'=>'d']]]]);
editor_check(count(array_filter($migratedSaved,static fn($e)=>($e['value']['intervalKey']??null)==='d'))===0,'migrated string-offset trip saves Down deletion');
