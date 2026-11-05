<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_core/trip_editor.php';
require_once __DIR__.'/../api/_core/trip_time_bank.php';
function check_pending($actual,$expected,$message){if($actual!==$expected)throw new RuntimeException($message.' '.json_encode([$actual,$expected]));echo 'PASS '.$message.PHP_EOL;}
$events=[['id'=>1,'event'=>'trip.started','timestamp'=>'2026-11-03T12:00:00.000Z','value'=>['standardTimeMilliseconds'=>1800000,'creationAnchor'=>'2026-11-03T00:00:00Z','creationTime'=>'12:00:00','startTime'=>'12:00:00','scheduledStart'=>'12:00:00']],
 ['id'=>2,'event'=>'interval.started','timestamp'=>'2026-11-03T12:05:00Z','value'=>['intervalKey'=>'down','type'=>'down','approvalState'=>'pending']],
 ['id'=>3,'event'=>'interval.ended','timestamp'=>'2026-11-03T12:15:00Z','value'=>['intervalKey'=>'down']],
 ['id'=>4,'event'=>'trip.stopped','timestamp'=>'2026-11-03T12:30:00Z','value'=>[]]];
$trip=['startTime'=>$events[0]['timestamp'],'endTime'=>$events[3]['timestamp'],'standardTimeMilliseconds'=>1800000,'countedTimeMilliseconds'=>1200000];
$copy=$events;
check_pending(trip_edit_aggregate($events)['counted'],1200000,'Pending is deducted by default');
check_pending(trip_time_bank_projection($trip,$events,false)['productiveTimeMilliseconds'],1800000,'master off includes all Pending in aggregate work');
check_pending($events,$copy,'read policy does not modify stored events');
foreach(['approved','unapproved','pending'] as $state){
 $changed=trip_edit_apply($events,['operation'=>'entry','entry'=>['eventId'=>2,'intervalKey'=>'down','type'=>'down','start'=>$events[1]['timestamp'],'end'=>$events[2]['timestamp'],'approvedTime'=>$state==='approved'?300000:null,'approvalState'=>$state]]);
 check_pending(trip_edit_aggregate($changed)['counted'],$state==='approved'?1500000:($state==='unapproved'?1800000:1200000),'editor preserves '.$state.' accounting');
 $project=trip_time_bank_projection($trip,$changed,false);
 check_pending($project['productiveTimeMilliseconds'],$state==='approved'?1500000:1800000,'aggregate master affects Pending only: '.$state);
}

$fixture=json_decode(file_get_contents(__DIR__.'/fixtures/pending-down-late-lunch.json'),true,512,JSON_THROW_ON_ERROR);
$reference=$fixture['trip'];$events=$reference['events'];
foreach([true,false] as $include){
 $bank=trip_time_bank_projection($reference,$events,$include);
 $work=$bank['productiveTimeMilliseconds']??$reference['countedTimeMilliseconds'];
 check_pending($work,$fixture['expected'][$include?'includedWork':'excludedWork'],'two Pending intervals plus late Lunch: '.($include?'applied':'not applied'));
 check_pending(number_format(100*$reference['standardTimeMilliseconds']/$work,2),$include?'98.45':'61.44','correct reference percent');
}
