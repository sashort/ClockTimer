<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_core/trip_editor.php';
require_once __DIR__.'/../api/_core/trip_time_bank.php';
function official_check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);echo "PASS $message\n";}
function official_reject(callable $fn,string $message):void{try{$fn();}catch(InvalidArgumentException){official_check(true,$message);return;}throw new RuntimeException($message);}
$events=[['id'=>1,'event'=>'trip.started','timestamp'=>'2026-10-01 10:00:00.000','value'=>['standardTimeMilliseconds'=>1800000,'creationAnchor'=>'2026-10-01T00:00:00Z','creationTime'=>'10:00:00','scheduledStart'=>'10:00:00','startTime'=>'10:00:00','nonProduction'=>false]],['id'=>2,'event'=>'trip.stopped','timestamp'=>'2026-10-01 10:27:00.000','value'=>[]]];
$trip=['startTime'=>'2026-10-01T10:00:00Z','endTime'=>'2026-10-01T10:27:00Z','standardTimeMilliseconds'=>1800000,'countedTimeMilliseconds'=>1620000];
$set=trip_edit_apply($events,['operation'=>'official-percent','percentTenths'=>1125,'_actorId'=>7]);$set[2]['id']=3;
$bank=trip_time_bank_projection($trip,$set);official_check(abs($bank['officialCorrection']['adjustmentMilliseconds']-22500)<1e-6,'official 112.5 creates exact bank credit');official_check($bank['officialCorrection']['createdBy']===7,'operator is retained');
$lower=trip_edit_apply($set,['operation'=>'official-percent','percentTenths'=>800]);$lower[count($lower)-1]['id']=4;$p=trip_time_bank_projection($trip,$lower);official_check(abs($p['allowanceCreditMilliseconds']+504000)<1e-6,'negative bank adjustment is supported');
$high=trip_edit_apply($set,['operation'=>'official-percent','percentTenths'=>4101]);official_check(trip_time_bank_projection($trip,$high)['officialCorrection']['percent']===410.1,'official results are not limited by 150 percent goal cap');
$changed=$trip;$changed['standardTimeMilliseconds']=900000;$p=trip_time_bank_projection($changed,$set);official_check(abs(($changed['standardTimeMilliseconds']+$p['allowanceCreditMilliseconds'])/$p['productiveTimeMilliseconds']-1.125)<1e-10,'changing standard time preserves entered percent');
$changed=$trip;$changed['countedTimeMilliseconds']=2000000;$p=trip_time_bank_projection($changed,$set);official_check(abs(($changed['standardTimeMilliseconds']+$p['allowanceCreditMilliseconds'])/$p['productiveTimeMilliseconds']-1.125)<1e-10,'changing work recalculates adjustment');
$cleared=trip_edit_apply($set,['operation'=>'official-percent-clear','_actorId'=>7]);official_check(trip_official_record($cleared)===null&&trip_official_has_history($cleared),'Clear removes override but keeps audit history');official_check(trip_time_bank_projection($trip,$cleared)===null,'Clear restores original non-credit calculation');
official_reject(fn()=>trip_edit_apply([$events[0]],['operation'=>'official-percent','percentTenths'=>1125]),'running trip rejected');
$break=$events;$break[0]['value']['breakOnly']=true;official_reject(fn()=>trip_edit_apply($break,['operation'=>'official-percent','percentTenths'=>1125]),'standalone break rejected');
official_check(trip_time_bank_projection($trip,trip_edit_apply($events,['operation'=>'official-percent','percentTenths'=>0]))['officialCorrection']['percent']===0,'zero official result is supported without enabling zero goals');
official_reject(fn()=>trip_edit_apply($events,['operation'=>'official-percent','percentTenths'=>-1]),'negative official result rejected');
official_reject(fn()=>trip_edit_apply($events,['operation'=>'official-percent','percentTenths'=>112.5]),'non-integer tenths rejected');
official_reject(fn()=>trip_edit_persistence_plan($set,$events),'protected audit deletion rejected');
$mutated=$set;$mutated[2]['value']['percentTenths']=900;official_reject(fn()=>trip_edit_persistence_plan($set,$mutated),'protected audit rewrite rejected');
$plan=trip_edit_persistence_plan($events,$set);official_check($plan['keep']===[1,2]&&count($plan['insert'])===1&&$plan['delete']===[],'correction appends without rewriting factual records');

$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$pdo->exec('CREATE TABLE event_types(id INTEGER PRIMARY KEY,name TEXT UNIQUE,description TEXT,reconstruction INTEGER)');
official_check(trip_official_event_type_id($pdo,'trip.official-percent-set')===15,'cold database registers official set type');
official_check(trip_official_event_type_id($pdo,'trip.official-percent-cleared')===16,'cold database registers clear type');
official_check(trip_official_event_type_id($pdo,'trip.official-percent-set')===15&&$pdo->query('SELECT COUNT(*) FROM event_types')->fetchColumn()==2,'registration is idempotent');
