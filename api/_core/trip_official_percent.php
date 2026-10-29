<?php
declare(strict_types=1);

function trip_official_record(array $events): ?array {
    $record=null;
    foreach($events as $event)if(in_array($event['event']??'', ['trip.official-percent-set','trip.official-percent-cleared'],true))$record=$event;
    return ($record['event']??'')==='trip.official-percent-set'?$record:null;
}
function trip_official_assert_completed(array $events): void {
    $started=null;$stopped=null;
    foreach($events as $event){if($event['event']==='trip.started'){$started=$event;$stopped=null;}if($event['event']==='trip.stopped')$stopped=$event;}
    if(!$started||!$stopped||!empty($started['value']['breakOnly']))throw new InvalidArgumentException('Official percentages require a completed trip.');
}
function trip_official_projection(array $trip,array $events,?array $bank=null): ?array {
    $record=trip_official_record($events);
    if(!$record||!empty($trip['running'])||!empty($trip['breakOnly']))return $bank;
    trip_official_assert_completed($events);
    $tenths=$record['value']['percentTenths']??null;
    if(!is_int($tenths)||$tenths<0)return $bank;
    $productive=$bank['productiveTimeMilliseconds']??$trip['countedTimeMilliseconds']??0;
    $standard=$trip['standardTimeMilliseconds']??0;
    if(!is_numeric($productive)||$productive<=0||!is_numeric($standard)||$standard<=0)return $bank;
    $baseCredit=$bank['allowanceCreditMilliseconds']??0;
    $credit=($tenths/1000)*$productive-$standard;
    $balance=$productive-$credit;
    return array_merge($bank??[],['productiveTimeMilliseconds'=>$productive,'allowanceCreditMilliseconds'=>$credit,
        'countedTimeBalanceMilliseconds'=>$balance,'bankCreditCarryMilliseconds'=>max(0,-$balance),
        'officialCorrection'=>['percentTenths'=>$tenths,'percent'=>$tenths/10,'adjustmentMilliseconds'=>$credit-$baseCredit,
            'baseAllowanceCreditMilliseconds'=>$baseCredit,'calculatedPercent'=>100*($standard+$baseCredit)/$productive,
            'eventId'=>$record['id']??null,'createdBy'=>$record['value']['createdBy']??null,'recordedAt'=>$record['timestamp']]]);
}

function trip_official_has_history(array $events): bool {
    foreach($events as $event)if(str_starts_with($event['event']??'', 'trip.official-percent-'))return true;
    return false;
}

function trip_official_event_type_id(PDO $pdo,string $event): int {
    $id=match($event){'trip.official-percent-set'=>15,'trip.official-percent-cleared'=>16,default=>throw new InvalidArgumentException('Unknown official event type.')};
    $sql=$pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql'?'INSERT IGNORE':'INSERT OR IGNORE';
    $pdo->prepare($sql.' INTO event_types (id,name,description,reconstruction) VALUES (:id,:name,:description,0)')->execute([':id'=>$id,':name'=>$event,':description'=>'Completed trip official percentage audit.']);
    $statement=$pdo->prepare('SELECT id FROM event_types WHERE name=:name');$statement->execute([':name'=>$event]);
    $saved=(int)$statement->fetchColumn();if(!$saved)throw new RuntimeException('Official event type registration failed.');return $saved;
}
