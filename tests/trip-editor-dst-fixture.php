<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_core/trip_editor.php';
$cases=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
$results=[];
foreach($cases as $case){
    date_default_timezone_set($case['timezone']);
    $events=isset($case['change'])?trip_edit_apply($case['events'],$case['change']):$case['events'];
    $results[]=['events'=>$events,'settings'=>trip_edit_api_settings($events),'trip'=>trip_edit_preview($events,['changes'=>[]],41)];
}
echo json_encode($results,JSON_THROW_ON_ERROR);
