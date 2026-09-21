<?php
declare(strict_types=1);

function trip_edit_revision(array $events): string {
    return hash('sha256', json_encode($events, JSON_THROW_ON_ERROR));
}

function trip_edit_persistence_plan(array $existing, array $edited): array {
    $before=[];foreach($existing as $event)if($event['id']!==null)$before[(string)$event['id']]=$event;
    $keep=[];$delete=[];$insert=[];
    foreach($edited as $event) {
        $id=$event['id'];$original=$id===null?null:($before[(string)$id]??null);
        if($original!==null&&$original['event']===$event['event']&&$original['timestamp']===$event['timestamp']&&$original['value']===$event['value']){$keep[]=(int)$id;unset($before[(string)$id]);continue;}
        if($original!==null){$delete[]=(int)$id;unset($before[(string)$id]);}
        $event['id']=null;$insert[]=$event;
    }
    foreach($before as $event)$delete[]=(int)$event['id'];
    return ['keep'=>$keep,'delete'=>array_values(array_unique($delete)),'insert'=>$insert];
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
function trip_edit_apply(array $events, array $input, bool $validate=true): array {
    $operation=$input['operation']??'';
    if ($operation==='entries') {
        $changes=$input['changes']??null;
        if (!is_array($changes) || count($changes)>500) throw new InvalidArgumentException('Invalid entry changes.');
        foreach ($changes as $change) {
            if (!is_array($change) || !in_array($change['operation']??'', ['entry','add-entry','delete-entry'], true)) throw new InvalidArgumentException('Invalid entry change.');
            $events=trip_edit_apply($events,$change,false);
        }
    } elseif ($operation==='settings') {
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
            $type=$entry['type']??'break';$breakType=$entry['breakType']??null;$approvedTime=$entry['approvedTime']??null;
            if ($type==='break' && !in_array($breakType,['break','short',null],true)) throw new InvalidArgumentException('Unknown break type.');
            if($type==='down' && $approvedTime!==null && $approvedTime!=='') trip_edit_duration($approvedTime);
            $events[]=['id'=>null,'event'=>'interval.started','timestamp'=>trip_edit_iso($entry['start']??''),
                'value'=>['type'=>$type,'length'=>$entry['length']??null,'approvedTime'=>$type==='down'?$approvedTime:null,'attributes'=>$type==='break'?['breakType'=>$breakType??'break']:[], 'intervalKey'=>$key]];
            $events[]=['id'=>null,'event'=>'interval.ended','timestamp'=>trip_edit_iso($entry['end']??''),'value'=>['intervalKey'=>$key]];
            $found=true;
        }
        foreach ($events as &$e) {
            if ($key !== null && ($e['value']['intervalKey']??null)===$key) {
                $found=true;
                if ($operation==='delete-entry') {$e['_delete']=true;continue;}
                if ($e['event']==='interval.started') {
                    $e['timestamp']=trip_edit_iso($entry['start']??'');
                    if (!in_array($entry['type']??null,['break','lunch','down'],true)) throw new InvalidArgumentException('Unknown entry type.');
                    $e['value']['type']=$entry['type'];
                    if ($entry['type']==='break') {
                        $breakType=$entry['breakType']??'break';
                        if (!in_array($breakType,['break','short'],true)) throw new InvalidArgumentException('Unknown break type.');
                        $e['value']['attributes']=array_merge($e['value']['attributes']??[],['breakType'=>$breakType]);
                    } elseif (isset($e['value']['attributes']['breakType'])) unset($e['value']['attributes']['breakType']);
                    if (isset($entry['length']) && $entry['length']!=='') {trip_edit_duration($entry['length']);$e['value']['length']=$entry['length'];}
                    if ($entry['type']==='down') {
                        $approvedTime=$entry['approvedTime']??null;
                        if($approvedTime!==null && $approvedTime!=='') trip_edit_duration($approvedTime);
                        $e['value']['approvedTime']=$approvedTime;
                    } else unset($e['value']['approvedTime']);
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
        if(in_array($operation,['entry','add-entry'],true)) {
            $type=$entry['type']??'';$approvedTime=$entry['approvedTime']??null;$approvalFound=false;
            foreach($events as &$e)if(($e['event']??'')==='interval.approval-changed'&&($e['value']['intervalKey']??null)===$key){$approvalFound=true;if($type==='down'){$e['value']['state']='approved';$e['value']['value']=$approvedTime;}else $e['_delete']=true;}
            unset($e);
            if($type==='down'&&is_string($approvedTime)&&$approvedTime!==''&&!$approvalFound)$events[]=['id'=>null,'event'=>'interval.approval-changed','timestamp'=>trip_edit_iso($entry['end']??$entry['start']??''),'value'=>['intervalKey'=>$key,'state'=>'approved','value'=>$approvedTime]];
        }
        if (!$found) throw new InvalidArgumentException('Entry no longer exists.');
        $events=array_values(array_filter($events,static fn($e)=>!($e['_delete']??false)));
    } else throw new InvalidArgumentException('Unknown edit operation.');
    usort($events,static fn($a,$b)=>strcmp($a['timestamp'],$b['timestamp'])?:((int)$a['id']<=>(int)$b['id']));
    if ($validate) trip_edit_aggregate($events);
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
        if($e['event']==='interval.started') $intervals[$key]=['start'=>$time,'type'=>$e['value']['type'],'length'=>$e['value']['length']??null,'startBuffer'=>$e['value']['startBuffer']??null,'endBuffer'=>$e['value']['endBuffer']??null,'approvedTime'=>$e['value']['approvedTime']??null,'end'=>null];
        if($e['event']==='interval.ended') {
            if(!isset($intervals[$key])) throw new InvalidArgumentException('Entry end precedes its start.');
            $intervals[$key]['end']=$time;
        }
        if($e['event']==='interval.approval-changed'&&isset($intervals[$key]))$intervals[$key]['approvedTime']=($e['value']['state']??'')==='approved'?($e['value']['value']??null):'0:00:00';
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
        if(in_array($i['type'],['break','lunch'],true)) {
            $planned=0;foreach(['length','startBuffer','endBuffer'] as $field)if(is_string($i[$field])&&$i[$field]!=='')$planned+=trip_edit_duration($i[$field]);
            $excluded[]=[max($begin,$i['start']),min($terminal,$i['start']+($planned?:$finish-$i['start']))];
        } elseif($i['type']==='down') {
            $approved=$i['approvedTime']==='0:00:00'?0:(is_string($i['approvedTime'])&&$i['approvedTime']!==''?trip_edit_duration($i['approvedTime']):$finish-$i['start']);
            $excluded[]=[max($begin,$i['start']),min($terminal,$i['start']+$approved)];
        }
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
