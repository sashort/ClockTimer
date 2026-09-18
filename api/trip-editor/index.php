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
    json_response(['tripId'=>$tripId,'events'=>$events,'settings'=>trip_edit_settings($events),'revision'=>trip_edit_revision($events)]);
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
        $events=trip_edit_apply($existing,$input);$ids=[];
        foreach($events as $e) {
            $value=json_encode($e['value'],JSON_THROW_ON_ERROR);
            if($e['id']!==null) {
                $ids[]=(int)$e['id'];
                $pdo->prepare('UPDATE trip_events SET timestamp=:time,value=:value WHERE id=:id AND trip_id=:trip')->execute([':time'=>$e['timestamp'],':value'=>$value,':id'=>$e['id'],':trip'=>$tripId]);
            } else {
                $typeId=require_trip_event_type_id($pdo,$e['event']);
                $pdo->prepare('INSERT INTO trip_events (trip_id,event_type_id,timestamp,value) VALUES (:trip,:type,:time,:value)')->execute([':trip'=>$tripId,':type'=>$typeId,':time'=>$e['timestamp'],':value'=>$value]);
                $ids[]=(int)$pdo->lastInsertId();
            }
        }
        $pdo->prepare('DELETE FROM trip_events WHERE trip_id=? AND id NOT IN ('.implode(',',array_fill(0,count($ids),'?')).')')->execute([$tripId,...$ids]);
        $a=trip_edit_aggregate($events);
        $pdo->prepare('UPDATE trips SET start_time=:start,end_time=:end,standard_time_ms=:standard,counted_time_ms=:counted,non_production=:non WHERE id=:id')->execute([
            ':start'=>$a['startTime'],':end'=>$a['endTime'],':standard'=>$a['standard'],':counted'=>$a['counted'],':non'=>$a['nonProduction'],':id'=>$tripId]);
        $saved=fetch_trip_events($pdo,$tripId,'log');
        return ['tripId'=>$tripId,'events'=>$saved,'revision'=>trip_edit_revision($saved),'settings'=>trip_edit_settings($saved)];
    });
    json_response($result);
} catch(InvalidArgumentException $error) {api_error($error->getMessage(),422,'invalid_trip_edit');}
