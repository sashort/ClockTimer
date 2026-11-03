<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/_core/bootstrap.php';
require_once dirname(__DIR__).'/_core/trip_editor.php';
$method=require_method('GET','POST');
$input=$method==='GET'?$_GET:json_input();
$tripId=require_positive_int($input,'tripId');
$pdo=db();require_trip_owner($pdo,$tripId);
if($method==='GET') {
    $events=fetch_trip_events($pdo,$tripId,'log');
    json_response(['tripId'=>$tripId,'events'=>$events,'settings'=>trip_edit_api_settings($events),'revision'=>trip_edit_revision($events)]);
}
require_csrf();
try {
    $result=audited_write(static function(PDO $pdo) use($input,$tripId):array {
        $mysql=$pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql';
        $lock=$pdo->prepare('SELECT id FROM trips WHERE id=:id'.($mysql?' FOR UPDATE':''));$lock->execute([':id'=>$tripId]);
        require_trip_owner($pdo,$tripId);
        $existing=fetch_trip_events($pdo,$tripId,'log');
        if(!is_string($input['revision']??null) || !hash_equals(trip_edit_revision($existing),$input['revision'])) api_error('This trip changed. Reopen the editor and try again.',409,'trip_edit_conflict');
        if(($input['operation']??'')==='delete-trip') {
            $pdo->prepare('DELETE FROM trip_events WHERE trip_id=:id')->execute([':id'=>$tripId]);
            $pdo->prepare('DELETE FROM trips WHERE id=:id')->execute([':id'=>$tripId]);
            return ['tripId'=>$tripId,'deleted'=>true];
        }
        $input['_actorId']=authenticated_user_id();
        $events=trip_edit_apply($existing,$input);$plan=trip_edit_persistence_plan($existing,$events);$ids=$plan['keep'];
        if (($input['operation']??'')==='settings' && trip_storage_uses_offsets($pdo)) {
            $settings=trip_edit_settings($events);
            trip_storage_update($pdo,$tripId,['scheduled_start_time'=>trip_edit_clock_iso($settings['creationAnchor'],$settings['scheduledStart'])]);
        }
        if($plan['delete'])$pdo->prepare('DELETE FROM trip_events WHERE trip_id=? AND id IN ('.implode(',',array_fill(0,count($plan['delete']),'?')).')')->execute([$tripId,...$plan['delete']]);
        foreach($plan['insert'] as $e) {
            $value=json_encode($e['value'],JSON_THROW_ON_ERROR);
            $typeId=str_starts_with($e['event'],'trip.official-percent-')?trip_official_event_type_id($pdo,$e['event']):require_trip_event_type_id($pdo,$e['event']);
            trip_storage_insert_event($pdo,['trip_id'=>$tripId,'event_type_id'=>$typeId,'timestamp'=>$e['timestamp'],'value'=>$value],$e['event'],true);
            $ids[]=(int)$pdo->lastInsertId();
        }
        $a=trip_edit_aggregate($events);
        trip_storage_update($pdo,$tripId,['start_time'=>$a['startTime'],'end_time'=>$a['endTime'],'standard_time_ms'=>$a['standard'],'counted_time_ms'=>$a['counted'],'non_production'=>$a['nonProduction']]);
        $saved=fetch_trip_events($pdo,$tripId,'log');
        return ['tripId'=>$tripId,'events'=>$saved,'revision'=>trip_edit_revision($saved),'settings'=>trip_edit_api_settings($saved)];
    });
    json_response($result);
} catch(InvalidArgumentException $error) {api_error($error->getMessage(),422,'invalid_trip_edit');}
