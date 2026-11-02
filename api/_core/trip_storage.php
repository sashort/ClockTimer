<?php
declare(strict_types=1);

/** Domain instants are signed integer milliseconds from one UTC scheduled start. */
function trip_storage_uses_offsets(PDO $pdo): bool {
    static $cache;
    $cache ??= new WeakMap();
    if (isset($cache[$pdo])) return $cache[$pdo];
    try { $pdo->query('SELECT scheduled_start_time, production FROM trips WHERE 1=0'); return $cache[$pdo]=true; }
    catch (PDOException) { return $cache[$pdo]=false; }
}
function trip_storage_read_table(PDO $pdo): string { return trip_storage_uses_offsets($pdo)?'trip_datetime_projection':'trips'; }
function trip_storage_event_read_table(PDO $pdo): string { return trip_storage_uses_offsets($pdo)?'trip_event_datetime_projection':'trip_events'; }
function trip_storage_epoch_ms(string $time): int {
    $date=new DateTimeImmutable($time,new DateTimeZone('UTC'));
    return (int)$date->format('U')*1000+intdiv((int)$date->format('u'),1000);
}
function trip_storage_instant(string $anchor,int $offset): string {
    $milliseconds=trip_storage_epoch_ms($anchor)+$offset;
    $seconds=(int)floor($milliseconds/1000);$fraction=$milliseconds-$seconds*1000;
    return gmdate('Y-m-d H:i:s',$seconds).'.'.str_pad((string)$fraction,3,'0',STR_PAD_LEFT);
}
function trip_storage_signed_ms(mixed $value,string $name): int {
    if(!is_int($value) && !(is_string($value)&&preg_match('/^-?\d+$/D',$value))) throw new InvalidArgumentException($name.' must be signed integer milliseconds.');
    $number=filter_var($value,FILTER_VALIDATE_INT);
    if($number===false || abs($number)>9007199254740991) throw new InvalidArgumentException($name.' exceeds exact millisecond precision.');
    return $number;
}
function trip_storage_production(array $values,array $current=[]): string {
    if(array_key_exists('production',$values)) {
        if(!in_array($values['production'],['yes','no','break-only'],true)) throw new InvalidArgumentException('production must be yes, no, or break-only.');
        return $values['production'];
    }
    if(!empty($values['break_only']??$current['break_only']??false)) return 'break-only';
    return !empty($values['non_production']??$current['non_production']??false)?'no':'yes';
}
function trip_storage_command(PDO $pdo,string $endpoint,array $input): array {
    if(isset($input['production'])) {$p=trip_storage_production($input);$input['breakOnly']=$p==='break-only';$input['nonProduction']=$p==='no';}
    $anchor=$input['scheduledStartTime']??null;
    if(is_string($anchor)) {
        if(!preg_match('/(?:Z|[+-]\d{2}:\d{2})$/D',$anchor))throw new InvalidArgumentException('scheduledStartTime must include its UTC offset.');
        $anchor=(new DateTimeImmutable($anchor))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.v');
        foreach(['startOffsetMilliseconds'=>'startTime','endOffsetMilliseconds'=>'endTime','offsetMilliseconds'=>'timestamp'] as $offset=>$time)
            if(array_key_exists($offset,$input))$input[$time]=trip_storage_instant($anchor,trip_storage_signed_ms($input[$offset],$offset));
        $input['scheduledStartTime']=$anchor;
    }
    if(trip_storage_uses_offsets($pdo)&&$endpoint==='trip-events'&&!array_key_exists('offsetMilliseconds',$input))
        throw new InvalidArgumentException('Reload Order Filler to use the current trip timeline format.');
    return $input;
}
function trip_storage_clock_offset(string $clock,string $midnight,string $anchor): int {
    if(!preg_match('/^(\d+):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/D',$clock,$m))throw new InvalidArgumentException('Invalid stored clock value.');
    return trip_storage_epoch_ms($midnight)+((int)$m[1]*3600+(int)$m[2]*60+(int)$m[3])*1000+(int)str_pad($m[4]??'',3,'0')-trip_storage_epoch_ms($anchor);
}
function trip_storage_encode_value(string $name,array $value,string $anchor,int $offset,bool $editor=false): array {
    $midnight=$value['creationAnchor']??substr($anchor,0,10).' 00:00:00.000';
    if($name==='trip.started') {
        if($editor||!isset($value['creationOffsetMilliseconds']))$value['creationOffsetMilliseconds']=isset($value['creationTime'])?trip_storage_clock_offset($value['creationTime'],$midnight,$anchor):$offset;
        if($editor||!isset($value['scheduledStartOffsetMilliseconds']))$value['scheduledStartOffsetMilliseconds']=isset($value['scheduledStart'])?trip_storage_clock_offset($value['scheduledStart'],$midnight,$anchor):0;
        $value['startOffsetMilliseconds']=$offset;$value['timelineVersion']=2;
        unset($value['creationAnchor'],$value['creationTime'],$value['startTime'],$value['scheduledStart'],$value['scheduledStartTime'],$value['instants']);
    }
    if(in_array($name,['trip.creation-time-changed','trip.scheduled-start-changed','trip.start-time-changed'],true)) {
        if($editor||!isset($value['valueOffsetMilliseconds']))$value['valueOffsetMilliseconds']=trip_storage_clock_offset((string)($value['value']??''),$midnight,$anchor);
        unset($value['value'],$value['creationAnchor']);
    }
    if($name==='trip.creation-date-changed') {
        if(!isset($value['valueOffsetMilliseconds']))$value['valueOffsetMilliseconds']=trip_storage_epoch_ms((string)($value['creationAnchor']??$value['value']))-trip_storage_epoch_ms($anchor);
        unset($value['value'],$value['creationAnchor']);
    }
    foreach(['boundary','restart'] as $prefix) if(isset($value[$prefix.'Time'])) {$value[$prefix.'OffsetMilliseconds']=trip_storage_epoch_ms($value[$prefix.'Time'])-trip_storage_epoch_ms($anchor);unset($value[$prefix.'Time']);}
    foreach(['scheduled-end','buffered-end','actual-end','early-start-end'] as $suffix) {
        $key='clock-timer-'.$suffix;
        if(isset($value['attributes'][$key])) {$value['attributes'][$key.'-offset-ms']=trip_storage_epoch_ms($value['attributes'][$key])-trip_storage_epoch_ms($anchor);unset($value['attributes'][$key]);}
    }
    return $value;
}
function trip_storage_shift_value(array $value,int $shift): array {
    foreach($value as $key=>$item) {
        if(is_array($item))$value[$key]=trip_storage_shift_value($item,$shift);
        elseif(is_int($item)&&(str_ends_with((string)$key,'OffsetMilliseconds')||str_ends_with((string)$key,'-offset-ms')))$value[$key]+=$shift;
    }
    return $value;
}
/** Compatibility labels are derived on read; none are independently persisted. */
function trip_storage_view_value(string $name,array $value,string $anchor,int $offset): array {
    $instant=static fn(int $ms):string=>trip_storage_instant($anchor,$ms);
    $clock=static fn(int $ms):string=>substr($instant($ms),11);
    if($name==='trip.started') {
        $value['creationAnchor']=substr($anchor,0,10).'T00:00:00.000Z';
        $value['creationTime']=$clock((int)($value['creationOffsetMilliseconds']??$offset));
        $value['scheduledStart']=$clock((int)($value['scheduledStartOffsetMilliseconds']??0));$value['startTime']=$clock($offset);
    }
    if(isset($value['valueOffsetMilliseconds'])) {
        if($name==='trip.creation-date-changed')$value['creationAnchor']=str_replace(' ','T',$instant((int)$value['valueOffsetMilliseconds'])).'Z';
        else $value['value']=$clock((int)$value['valueOffsetMilliseconds']);
    }
    foreach(['boundary','restart'] as $prefix) if(isset($value[$prefix.'OffsetMilliseconds']))$value[$prefix.'Time']=str_replace(' ','T',$instant((int)$value[$prefix.'OffsetMilliseconds'])).'Z';
    foreach(['scheduled-end','buffered-end','actual-end','early-start-end'] as $suffix){$key='clock-timer-'.$suffix;if(isset($value['attributes'][$key.'-offset-ms']))$value['attributes'][$key]=str_replace(' ','T',$instant((int)$value['attributes'][$key.'-offset-ms'])).'Z';}
    return $value;
}
function trip_storage_insert(PDO $pdo,array $values): int {
    if(trip_storage_uses_offsets($pdo)) {
        $anchor=$values['scheduled_start_time']??$values['start_time'];
        $values['production']=trip_storage_production($values);
        $values['start_offset_ms']=$values['start_offset_ms']??trip_storage_epoch_ms($values['start_time'])-trip_storage_epoch_ms($anchor);
        $values['end_offset_ms']=$values['end_offset_ms']??trip_storage_epoch_ms($values['end_time'])-trip_storage_epoch_ms($anchor);
        $values['scheduled_start_time']=$anchor;
        unset($values['start_time'],$values['end_time'],$values['non_production'],$values['break_only']);
    } else { unset($values['scheduled_start_time'],$values['production'],$values['start_offset_ms'],$values['end_offset_ms']); }
    $names=array_keys($values);$sql='INSERT INTO trips ('.implode(',',$names).') VALUES (:'.implode(',:',$names).')';
    $pdo->prepare($sql)->execute($values);return isset($values['id'])?(int)$values['id']:(int)$pdo->lastInsertId();
}
function trip_storage_update(PDO $pdo,int $id,array $values,?int $userId=null): void {
    if(trip_storage_uses_offsets($pdo)) {
        if (!$pdo->inTransaction()) throw new LogicException('Trip changes require an audited transaction.');
        $q=$pdo->prepare('SELECT * FROM trip_datetime_projection WHERE id=:id FOR UPDATE');$q->execute([':id'=>$id]);$old=$q->fetch();
        if(!$old)throw new InvalidArgumentException('Trip was not found.');
        if($userId!==null && (int)$old['user_id']!==$userId) throw new InvalidArgumentException('Trip owner does not match.');
        $anchor=$values['scheduled_start_time']??$old['scheduled_start_time'];
        $shift=trip_storage_epoch_ms($old['scheduled_start_time'])-trip_storage_epoch_ms($anchor);
        $values['production']=trip_storage_production($values,$old);
        $values['start_offset_ms']=isset($values['start_time'])?trip_storage_epoch_ms($values['start_time'])-trip_storage_epoch_ms($anchor):(int)$old['start_offset_ms']+$shift;
        $values['end_offset_ms']=isset($values['end_time'])?trip_storage_epoch_ms($values['end_time'])-trip_storage_epoch_ms($anchor):(int)$old['end_offset_ms']+$shift;
        if($shift) {
            // Rebase only the representation. The database guard permits this
            // exact shift and still rejects ordinary in-place event edits.
            $mysql=$pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql';
            if($mysql)$pdo->exec('SET @trip_anchor_rebase_ms = '.(string)$shift);
            try {
                $events=$pdo->prepare('SELECT id,value FROM trip_events WHERE trip_id=:trip');$events->execute([':trip'=>$id]);
                $update=$pdo->prepare('UPDATE trip_events SET offset_ms=offset_ms+:shift,value=:value WHERE id=:id');
                foreach($events->fetchAll() as $event)$update->execute([':shift'=>$shift,':value'=>json_encode(trip_storage_shift_value(json_decode($event['value'],true,512,JSON_THROW_ON_ERROR),$shift),JSON_THROW_ON_ERROR),':id'=>$event['id']]);
            }
            finally {if($mysql)$pdo->exec('SET @trip_anchor_rebase_ms = NULL');}
        }
        unset($values['start_time'],$values['end_time'],$values['non_production'],$values['break_only']);
    } else { unset($values['scheduled_start_time'],$values['production'],$values['start_offset_ms'],$values['end_offset_ms']); }
    $sets=[];$parameters=[':trip_id'=>$id];foreach($values as $name=>$value){$sets[]=$name.'=:'.$name;$parameters[':'.$name]=$value;}
    $where='id=:trip_id';if($userId!==null){$where.=' AND user_id=:owner_id';$parameters[':owner_id']=$userId;}
    $pdo->prepare('UPDATE trips SET '.implode(',',$sets).' WHERE '.$where)->execute($parameters);
}
function trip_storage_insert_event(PDO $pdo,array $event,?string $name=null,bool $editor=false): int {
    if(trip_storage_uses_offsets($pdo)) {
        $q=$pdo->prepare('SELECT scheduled_start_time FROM trips WHERE id=:id');$q->execute([':id'=>$event['trip_id']]);$anchor=$q->fetchColumn();
        if(!is_string($anchor))throw new InvalidArgumentException('Trip scheduled start is missing.');
        $event['offset_ms']=isset($event['offset_ms'])?trip_storage_signed_ms($event['offset_ms'],'offsetMilliseconds'):trip_storage_epoch_ms($event['timestamp'])-trip_storage_epoch_ms($anchor);
        if($name===null){$type=$pdo->prepare('SELECT name FROM event_types WHERE id=:id');$type->execute([':id'=>$event['event_type_id']]);$name=(string)$type->fetchColumn();}
        $event['value']=json_encode(trip_storage_encode_value($name,json_decode($event['value'],true,512,JSON_THROW_ON_ERROR),$anchor,$event['offset_ms'],$editor),JSON_THROW_ON_ERROR);
        unset($event['timestamp']);
    }else{unset($event['offset_ms']);}
    $names=array_keys($event);$pdo->prepare('INSERT INTO trip_events ('.implode(',',$names).') VALUES (:'.implode(',:',$names).')')->execute($event);
    return(int)$pdo->lastInsertId();
}
