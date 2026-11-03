<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_core/trip_editor.php';
require_once __DIR__.'/../api/_core/trip_time_bank.php';
function verify_start(bool $ok,string $name):void{if(!$ok)throw new RuntimeException($name);echo "PASS $name\n";}
$events=[['id'=>1,'event'=>'trip.started','timestamp'=>'2026-11-03 10:00:00.000','value'=>['standardTimeMilliseconds'=>1800000,'creationAnchor'=>'2026-11-03T00:00:00Z','creationTime'=>'10:00:00','scheduledStart'=>'10:00:00','startTime'=>'10:00:00','nonProduction'=>false]],['id'=>2,'event'=>'trip.stopped','timestamp'=>'2026-11-03 10:27:00.000','value'=>[]]];
$trip=['startTime'=>$events[0]['timestamp'],'endTime'=>$events[1]['timestamp'],'standardTimeMilliseconds'=>1800000,'countedTimeMilliseconds'=>1620000];
$set=trip_edit_apply($events,['operation'=>'official-percent','percentTenths'=>1125,'showOfficialStart'=>true]);
$p=trip_time_bank_projection($trip,$set);
verify_start($p['officialCorrection']['startTime']==='2026-11-03T10:00:20.000Z','112.5 percent derives Official Start without changing factual start');
$changed=trip_edit_apply($set,['operation'=>'official-start-time','startTime'=>'2026-11-03T10:00:30.123Z']);$p=trip_time_bank_projection($trip,$changed);
verify_start($p['officialCorrection']['startTime']==='2026-11-03T10:00:30.123Z','editing Official Start preserves the entered millisecond and derives percent');
verify_start(abs($p['officialCorrection']['percent']-180000000/(1620000-30123))<1e-9,'time-derived percentage retains precision beyond input tenths');
verify_start($changed[0]['timestamp']===$events[0]['timestamp'],'actual trip start is untouched');
$revised=$trip;$revised['standardTimeMilliseconds']=900000;$p=trip_time_bank_projection($revised,$set);
verify_start($p['officialCorrection']['percent']===112.5&&$p['officialCorrection']['startTime']==='2026-11-03T10:13:40.000Z','later Standard edits preserve official percent and recalculate Official Start');
$cleared=trip_edit_apply($set,['operation'=>'entries','changes'=>[['operation'=>'official-start-delete']]]);
verify_start(trip_official_record($cleared)===null&&trip_time_bank_projection($trip,$cleared)===null,'deleting Official Start clears the percentage and marker together');
verify_start(trip_time_bank_projection($trip,trip_edit_apply($set,['operation'=>'official-percent-clear']))===null,'clearing official percent removes the derived entry');
$plain=trip_edit_apply($events,['operation'=>'official-percent','percentTenths'=>1125,'showOfficialStart'=>false]);
verify_start(trip_time_bank_projection($trip,$plain)['officialCorrection']['startTime']===null,'No keeps the existing adjustment-only flow');
foreach([['operation'=>'official-percent','percentTenths'=>0,'showOfficialStart'=>true],['operation'=>'official-start-time','startTime'=>'2026-11-03T10:30:00Z']] as $input){try{trip_edit_apply($set,$input);throw new RuntimeException('Invalid derived time accepted');}catch(InvalidArgumentException){verify_start(true,'invalid derived Official Start rejected');}}
