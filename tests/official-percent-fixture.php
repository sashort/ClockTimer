<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_core/trip_editor.php';require_once __DIR__.'/../api/_core/trip_time_bank.php';
$input=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$events=$input['events'];
if(isset($input['change'])){$change=$input['change'];if(!hash_equals(trip_edit_revision($events),$change['revision']))throw new RuntimeException('Revision conflict');$change['_actorId']=2;$events=trip_edit_apply($events,$change);$next=max(array_map(static fn($e)=>(int)$e['id'],$input['events']))+1;foreach($events as &$e)if($e['id']===null)$e['id']=$next++;unset($e);}
$a=trip_edit_aggregate($events);$trip=['id'=>41,'startTime'=>str_replace(' ','T',$a['startTime']).'Z','endTime'=>str_replace(' ','T',$a['endTime']).'Z','standardTimeMilliseconds'=>$a['standard'],'countedTimeMilliseconds'=>$a['counted'],'actualTimeMilliseconds'=>(strtotime($a['endTime'].' UTC')-strtotime($a['startTime'].' UTC'))*1000,'running'=>false,'events'=>$events];
$trip=array_merge($trip,trip_time_bank_projection($trip,$events)??[]);echo json_encode(['trip'=>$trip,'tripId'=>41,'revision'=>trip_edit_revision($events),'settings'=>trip_edit_settings($events),'events'=>$events],JSON_THROW_ON_ERROR);
