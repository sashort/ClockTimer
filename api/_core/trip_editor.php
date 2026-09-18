<?php
declare(strict_types=1);

function trip_edit_revision(array $events): string {
    return hash('sha256', json_encode($events, JSON_THROW_ON_ERROR));
}

function trip_edit_duration(string $value): int {
    if (!preg_match('/^(?:(\d+):)?([0-5]?\d):([0-5]\d)(?:\.(\d{1,3}))?$/D', $value, $m)) throw new InvalidArgumentException('Use h:mm:ss.');
    $ms = ((int)$m[1]*3600+(int)$m[2]*60+(int)$m[3])*1000+(int)str_pad($m[4]??'',3,'0');
    if ($ms < 1 || $ms > 31536000000) throw new InvalidArgumentException('Enter a positive duration shorter than one year.');
    return $ms;
}

function trip_edit_iso(string $value): string {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/D', $value)) throw new InvalidArgumentException('Use a date and time with a timezone.');
    $date=new DateTimeImmutable($value);$errors=DateTimeImmutable::getLastErrors();
    if ($errors && ($errors['warning_count'] || $errors['error_count'])) throw new InvalidArgumentException('Invalid date or time.');
    return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.v');
}

function trip_edit_settings(array $events): array {
    $settings=[];
    foreach ($events as $event) {
        $v=$event['value'];
        if ($event['event']==='trip.started') $settings=$v;
        $fields=['trip.standard-time-changed'=>'standardTime','trip.creation-time-changed'=>'creationTime',
            'trip.scheduled-start-changed'=>'scheduledStart','trip.start-time-changed'=>'startTime'];
        if (isset($fields[$event['event']])) $settings[$fields[$event['event']]]=$v['value'];
        if ($event['event']==='trip.creation-date-changed' && isset($v['creationAnchor'])) $settings['creationAnchor']=$v['creationAnchor'];
        if (isset($v['nonProduction'])) $settings['nonProduction']=$v['nonProduction'];
    }
    return $settings;
}

/** Edits preserve event IDs and interval keys; the normal ClockTimer replay remains authoritative. */
function trip_edit_apply(array $events, array $input): array {
    $operation=$input['operation']??'';
    if ($operation==='settings') {
        $s=$input['settings']??null;
        if (!is_array($s) || !is_bool($s['nonProduction']??null)) throw new InvalidArgumentException('Invalid trip settings.');
        trip_edit_duration($s['standardTime']??'');
        $anchor=trip_edit_iso($s['creationAnchor']??'');
        foreach (['creationTime','scheduledStart','startTime'] as $field) {
            if (!preg_match('/^(\d+):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?$/D',$s[$field]??'',$m) || ($field==='creationTime' && (int)$m[1]>23)) throw new InvalidArgumentException('Invalid trip time.');
        }
        $effective=trip_edit_settings($events);
        $events=array_values(array_filter($events,static fn($e)=>!in_array($e['event'],[
            'trip.standard-time-changed','trip.creation-time-changed','trip.creation-date-changed','trip.scheduled-start-changed','trip.start-time-changed'],true)));
        foreach ($events as &$e) if ($e['event']==='trip.started') {
            $e['value']=array_merge($effective,$s);
            $e['timestamp']=trip_edit_clock_iso($anchor,$s['startTime']);
        }
        unset($e);
    } elseif ($operation==='entry' || $operation==='add-entry' || $operation==='delete-entry') {
        $entry=$input['entry']??[];$key=$entry['intervalKey']??null;$found=false;
        if ($operation==='add-entry') {
            $key='edit-'.bin2hex(random_bytes(16));
            $entry['intervalKey']=$key;
            $events[]=['id'=>null,'event'=>'interval.started','timestamp'=>trip_edit_iso($entry['start']??''),
                'value'=>['type'=>$entry['type']??'break','length'=>$entry['length']??null,'attributes'=>[], 'intervalKey'=>$key]];
            $events[]=['id'=>null,'event'=>'interval.ended','timestamp'=>trip_edit_iso($entry['end']??''),'value'=>['intervalKey'=>$key]];
            $found=true;
        }
        foreach ($events as &$e) {
            if ($key !== null && ($e['value']['intervalKey']??null)===$key) {
                $found=true;
                if ($operation==='delete-entry') {$e['_delete']=true;continue;}
                if ($e['event']==='interval.started') {
                    $e['timestamp']=trip_edit_iso($entry['start']??'');
                    if (!in_array($entry['type']??null,['break','down','latency','trip','overtime','earlystart'],true)) throw new InvalidArgumentException('Unknown entry type.');
                    $e['value']['type']=$entry['type'];
                    if (isset($entry['length']) && $entry['length']!=='') {trip_edit_duration($entry['length']);$e['value']['length']=$entry['length'];}
                } elseif ($e['event']==='interval.ended' && isset($entry['end'])) $e['timestamp']=trip_edit_iso($entry['end']);
            } elseif ($key===null && (int)($entry['eventId']??0)===(int)($e['id']??-1)) {
                if ($operation==='delete-entry') throw new InvalidArgumentException('Trip start and end cannot be removed.');
                if (!in_array($e['event'],['trip.started','trip.stopped'],true)) throw new InvalidArgumentException('Select an interval or trip boundary.');
                $found=true;$e['timestamp']=trip_edit_iso($entry['start']??'');
                if ($e['event']==='trip.started') {
                    $anchor=$e['value']['creationAnchor']??null;
                    if (!$anchor) throw new InvalidArgumentException('Trip has no creation anchor.');
                    $ms=(int)round((strtotime($e['timestamp'].' UTC')-strtotime($anchor))*1000);
                    if ($ms<0) throw new InvalidArgumentException('Start must follow the creation date.');
                    $e['value']['startTime']=sprintf('%d:%02d:%02d',intdiv($ms,3600000),intdiv($ms,60000)%60,intdiv($ms,1000)%60);
                }
            }
        }
        unset($e);
        if (!$found) throw new InvalidArgumentException('Entry no longer exists.');
        $events=array_values(array_filter($events,static fn($e)=>!($e['_delete']??false)));
    } else throw new InvalidArgumentException('Unknown edit operation.');
    usort($events,static fn($a,$b)=>strcmp($a['timestamp'],$b['timestamp'])?:((int)$a['id']<=>(int)$b['id']));
    trip_edit_aggregate($events);
    return $events;
}

function trip_edit_clock_iso(string $anchor,string $clock): string {
    preg_match('/^(\d+):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/D',$clock,$m);
    $milliseconds=((int)$m[1]*3600+(int)$m[2]*60+(int)$m[3])*1000+(int)str_pad($m[4]??'',3,'0');
    $date=new DateTimeImmutable($anchor,new DateTimeZone('UTC'));
    return $date->modify('+'.$milliseconds.' milliseconds')->format('Y-m-d H:i:s.v');
}

function trip_edit_aggregate(array $events): array {
    $s=trip_edit_settings($events);$start=null;$end=null;$intervals=[];$deleted=[];
    foreach($events as $e) {
        $time=(float)(new DateTimeImmutable($e['timestamp'],new DateTimeZone('UTC')))->format('U.u')*1000;
        if($e['event']==='trip.started') $start=$time;
        if($e['event']==='trip.stopped') $end=$time;
        $key=$e['value']['intervalKey']??'';
        if($e['event']==='interval.deleted') $deleted[$key]=true;
        if($e['event']==='interval.started') $intervals[$key]=['start'=>$time,'type'=>$e['value']['type'],'end'=>null];
        if($e['event']==='interval.ended') {
            if(!isset($intervals[$key])) throw new InvalidArgumentException('Entry end precedes its start.');
            $intervals[$key]['end']=$time;
        }
    }
    if($start===null || !isset($s['standardTime'],$s['scheduledStart'],$s['creationAnchor'])) throw new InvalidArgumentException('Trip settings are incomplete.');
    $scheduled=(float)(new DateTimeImmutable(trip_edit_clock_iso($s['creationAnchor'],$s['scheduledStart']),new DateTimeZone('UTC')))->format('U.u')*1000;
    $begin=min($start,$scheduled);$terminal=$end??round(microtime(true)*1000);
    if($terminal<$start) throw new InvalidArgumentException('Trip end must follow actual start.');
    $excluded=[];$occupied=[];
    foreach($intervals as $key=>$i) {
        if(isset($deleted[$key])) continue;
        $finish=$i['end']??$terminal;
        if($finish<=$i['start'] || $i['start']<$start || $finish>$terminal) throw new InvalidArgumentException('Entry must fit within the trip and end after its start.');
        $occupied[]=[$i['start'],$finish];
        if(in_array($i['type'],['break','down'],true)) $excluded[]=[max($begin,$i['start']),min($terminal,$finish)];
    }
    usort($occupied,static fn($a,$b)=>$a[0]<=>$b[0]);$lastFinish=null;
    foreach($occupied as [$a,$b]) {if($lastFinish!==null && $a<$lastFinish) throw new InvalidArgumentException('Entries cannot overlap.');$lastFinish=$b;}
    usort($excluded,static fn($a,$b)=>$a[0]<=>$b[0]);$last=$begin;$removed=0;
    foreach($excluded as [$a,$b]) {if($b>max($last,$a)) $removed+=$b-max($last,$a);$last=max($last,$b);}
    return ['startTime'=>gmdate('Y-m-d H:i:s',(int)floor($begin/1000)),
        'endTime'=>gmdate('Y-m-d H:i:s',(int)floor($terminal/1000)),
        'standard'=>trip_edit_duration($s['standardTime']),'counted'=>(int)max(0,round($terminal-$begin-$removed)),
        'nonProduction'=>($s['nonProduction']??false)?1:0];
}
