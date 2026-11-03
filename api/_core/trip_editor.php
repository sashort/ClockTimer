<?php
declare(strict_types=1);
require_once __DIR__.'/trip_official_percent.php';
require_once __DIR__.'/trip_storage.php';

function trip_edit_revision(array $events): string {
    return hash('sha256', json_encode($events, JSON_THROW_ON_ERROR));
}

function trip_edit_persistence_plan(array $existing, array $edited): array {
    $before=[];foreach($existing as $event)if($event['id']!==null)$before[(string)$event['id']]=$event;
    foreach($before as $original)if(str_starts_with($original['event'],'trip.official-percent-')){
        $match=array_values(array_filter($edited,static fn($event)=>($event['id']??null)===$original['id']));
        if(count($match)!==1||$match[0]['event']!==$original['event']||$match[0]['timestamp']!==$original['timestamp']||$match[0]['value']!==$original['value'])throw new InvalidArgumentException('Official adjustment history cannot be edited or deleted.');
    }
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

function trip_edit_duration_milliseconds(
    mixed $value,
    bool $allowZero = false
): int {
    if (!is_int($value)) {
        throw new InvalidArgumentException(
            'Duration must be an integer number of milliseconds.'
        );
    }

    $minimum =
        $allowZero
            ? 0
            : 1;

    if (
        $value < $minimum ||
        $value > 31536000000
    ) {
        throw new InvalidArgumentException(
            $allowZero
                ? 'Duration must be between zero and one year.'
                : 'Duration must be positive and shorter than one year.'
        );
    }

    return $value;
}

function trip_edit_iso(string $value): string {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/D', $value)) throw new InvalidArgumentException('Use a date and time with a timezone.');
    $date=new DateTimeImmutable($value);$errors=DateTimeImmutable::getLastErrors();
    if ($errors && ($errors['warning_count'] || $errors['error_count'])) throw new InvalidArgumentException('Invalid date or time.');
    return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.v');
}

function trip_edit_settings(array $events): array {
    $settings=[];$instants=[];
    foreach ($events as $event) {
        $v=$event['value'];
        if ($event['event']==='trip.started') $settings=$v;
        $fields=['trip.standard-time-changed'=>'standardTimeMilliseconds','trip.creation-time-changed'=>'creationTime',
            'trip.scheduled-start-changed'=>'scheduledStart','trip.start-time-changed'=>'startTime'];
        if (isset($fields[$event['event']]) && array_key_exists('value',$v)) $settings[$fields[$event['event']]]=$v['value'];
        if ($event['event']==='trip.creation-date-changed' && isset($v['creationAnchor'])) $settings['creationAnchor']=$v['creationAnchor'];
        if (isset($v['nonProduction'])) $settings['nonProduction']=$v['nonProduction'];
        if (isset($event['scheduledStartTime'])) {
            $anchor=$event['scheduledStartTime'];
            if($event['event']==='trip.started' && ($v['timelineVersion']??null)===2) {
                foreach(['creationTime'=>'creationOffsetMilliseconds','scheduledStart'=>'scheduledStartOffsetMilliseconds','startTime'=>'startOffsetMilliseconds'] as $field=>$key)
                    if(is_int($v[$key]??null))$instants[$field]=trip_storage_instant($anchor,$v[$key]);
            }
            $field=['trip.creation-date-changed'=>'creationTime','trip.creation-time-changed'=>'creationTime','trip.scheduled-start-changed'=>'scheduledStart','trip.start-time-changed'=>'startTime'][$event['event']]??null;
            if($field!==null&&is_int($v['valueOffsetMilliseconds']??null))$instants[$field]=trip_storage_instant($anchor,$v['valueOffsetMilliseconds']);
        }
    }
    if(count($instants)===3) {
        $midnight=substr(min($instants),0,10).' 00:00:00.000';
        $settings['creationAnchor']=str_replace(' ','T',$midnight).'Z';
        foreach($instants as $field=>$instant)$settings[$field]=trip_edit_offset_clock(trip_storage_epoch_ms($instant)-trip_storage_epoch_ms($midnight));
    }
    if (($settings['breakOnly'] ?? false) === true) {
        $settings['standardTimeMilliseconds'] = null;
        $settings['nonProduction'] = false;
    }
    return $settings;
}

/** Public editor transport uses exact instants; legacy clock aliases remain import-only. */
function trip_edit_api_settings(array $events): array {
    $settings=trip_edit_settings($events);
    $anchor=$settings['creationAnchor']??null;
    if(is_string($anchor)){
        foreach(['creationTime','scheduledStart','startTime'] as $field)
            $settings['instants'][$field]=str_replace(' ','T',trip_edit_clock_iso($anchor,$settings[$field])).'Z';
    }
    unset($settings['creationAnchor'],$settings['creationTime'],$settings['scheduledStart'],$settings['startTime']);
    return $settings;
}

function trip_edit_offset_clock(int $ms): string {
    return intdiv($ms,3600000).':'.str_pad((string)(intdiv($ms,60000)%60),2,'0',STR_PAD_LEFT).':'.str_pad((string)(intdiv($ms,1000)%60),2,'0',STR_PAD_LEFT).'.'.str_pad((string)($ms%1000),3,'0',STR_PAD_LEFT);
}

/** Edits preserve event IDs and interval keys; the normal ClockTimer replay remains authoritative. */
function trip_edit_apply(array $events, array $input, bool $validate=true): array {
    $operation=$input['operation']??'';
    if ($operation==='entries') {
        $changes=$input['changes']??null;
        if (!is_array($changes) || count($changes)>500) throw new InvalidArgumentException('Invalid entry changes.');
        foreach ($changes as $change) {
            if (!is_array($change) || !in_array($change['operation']??'', ['entry','add-entry','delete-entry','official-start-time','official-start-delete'], true)) throw new InvalidArgumentException('Invalid entry change.');
            $events=trip_edit_apply($events,$change,false);
        }
    } elseif (in_array($operation,['official-percent','official-percent-clear','official-start-time','official-start-delete'],true)) {
        trip_official_assert_completed($events);
        $timeEdit=$operation==='official-start-time';
        if($timeEdit||$operation==='official-start-delete'){
            $record=trip_official_record($events);
            if(empty($record['value']['showOfficialStart']))throw new InvalidArgumentException('No Official Start Time entry is currently applied.');
            if($operation==='official-start-delete')$operation='official-percent-clear';
        }
        $tenths=$input['percentTenths']??null;
        if($operation==='official-percent'&&(!is_int($tenths)||$tenths<0||$tenths>9007199254740991))throw new InvalidArgumentException('Enter a non-negative official percentage with one decimal place.');
        $aggregate=trip_edit_aggregate($events);
        require_once __DIR__.'/trip_time_bank.php';
        $trip=['startTime'=>$aggregate['startTime'],'endTime'=>$aggregate['endTime'],'standardTimeMilliseconds'=>$aggregate['standard'],'countedTimeMilliseconds'=>$aggregate['counted']];
        $base=trip_time_bank_base_projection($trip,$events);
        $percent=null;
        if($timeEdit){
            $start=array_values(array_filter($events,static fn($e)=>$e['event']==='trip.started'))[0];
            $productive=$base['productiveTimeMilliseconds']??$aggregate['counted'];
            $target=trip_storage_epoch_ms($start['timestamp'])+$productive-trip_storage_epoch_ms(trip_edit_iso($input['startTime']??''));
            if($target<=0)throw new InvalidArgumentException('Official Start Time must leave positive counted time.');
            $percent=100*($aggregate['standard']+($base['allowanceCreditMilliseconds']??0))/$target;
            if(!is_finite($percent)||$percent<=0||$percent>900719925474099.1)throw new InvalidArgumentException('Official Start Time produces an invalid percentage.');
            $tenths=(int)round($percent*10);$operation='official-percent';
        }
        $showStart=$timeEdit||($input['showOfficialStart']??false)===true;
        if($operation==='official-percent'&&$showStart&&($percent??$tenths/10)<=0)throw new InvalidArgumentException('Official Start Time requires a positive official percentage.');
        if($operation==='official-percent'&&($base['productiveTimeMilliseconds']??$aggregate['counted'])<=0)throw new InvalidArgumentException('Official percentages require positive worked time.');
        $stop=array_values(array_filter($events,static fn($e)=>$e['event']==='trip.stopped'));
        $stamp=new DateTimeImmutable('now',new DateTimeZone('UTC'));$end=new DateTimeImmutable(end($stop)['timestamp'],new DateTimeZone('UTC'));
        foreach($events as $prior)if(str_starts_with($prior['event'],'trip.official-percent-')){$at=new DateTimeImmutable($prior['timestamp'],new DateTimeZone('UTC'));if($at>$end)$end=$at;}
        $stamp=new DateTimeImmutable($stamp->format('Y-m-d H:i:s.v'),new DateTimeZone('UTC'));
        if($stamp<=$end)$stamp=$end->modify('+1 millisecond');
        if($operation==='official-percent-clear'&&!trip_official_record($events))throw new InvalidArgumentException('No official percentage is currently applied.');
        $events[]=['id'=>null,'event'=>$operation==='official-percent-clear'?'trip.official-percent-cleared':'trip.official-percent-set','timestamp'=>$stamp->format('Y-m-d H:i:s.v'),
            'value'=>['percentTenths'=>$tenths,'showOfficialStart'=>$operation==='official-percent'&&$showStart,...($percent!==null?['percent'=>$percent]:[]),'createdBy'=>is_int($input['_actorId']??null)?$input['_actorId']:null]];
    } elseif ($operation==='settings') {
        if ((trip_edit_settings($events)['breakOnly'] ?? false) === true) throw new InvalidArgumentException('Standard time and production settings do not apply to break-only sessions.');
        $s=$input['settings']??null;
        if (!is_array($s) || !is_bool($s['nonProduction']??null)) throw new InvalidArgumentException('Invalid trip settings.');
        $absolute=is_array($s['instants']??null);
        if($absolute){
            $instants=[];foreach(['creationTime','scheduledStart','startTime'] as $field)$instants[$field]=trip_edit_iso($s['instants'][$field]??'');
            $midnight=substr(min($instants),0,10).' 00:00:00.000';$s['creationAnchor']=str_replace(' ','T',$midnight).'Z';
            foreach($instants as $field=>$instant)$s[$field]=trip_edit_offset_clock(trip_storage_epoch_ms($instant)-trip_storage_epoch_ms($midnight));
            unset($s['instants']);
        }
        trip_edit_duration_milliseconds(
            $s['standardTimeMilliseconds'] ??
                null
        );
        $anchor=trip_edit_iso($s['creationAnchor']??'');
        foreach (['creationTime','scheduledStart','startTime'] as $field) {
            if (!preg_match('/^(\d+):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?$/D',$s[$field]??'',$m) || (!$absolute && $field==='creationTime' && (int)$m[1]>23)) throw new InvalidArgumentException('Invalid trip time.');
        }
        $effective=trip_edit_settings($events);
        $events=array_values(array_filter($events,static fn($e)=>!in_array($e['event'],[
            'trip.standard-time-changed','trip.creation-time-changed','trip.creation-date-changed','trip.scheduled-start-changed','trip.start-time-changed'],true)));
        foreach ($events as &$e) if ($e['event']==='trip.started') {
            $e['value']=array_merge($effective,$s);
            $e['timestamp']=trip_edit_clock_iso($anchor,$s['startTime']);
            if($absolute || ($e['value']['timelineVersion']??null)===2){
                $scheduled=trip_edit_clock_iso($anchor,$s['scheduledStart']);$e['scheduledStartTime']=str_replace(' ','T',$scheduled).'Z';
                foreach(['creationTime'=>'creationOffsetMilliseconds','scheduledStart'=>'scheduledStartOffsetMilliseconds','startTime'=>'startOffsetMilliseconds'] as $field=>$key)
                    $e['value'][$key]=trip_storage_epoch_ms(trip_edit_clock_iso($anchor,$s[$field]))-trip_storage_epoch_ms($scheduled);
                $e['value']['timelineVersion']=2;
            }
        }
        unset($e);
    } elseif ($operation==='entry' || $operation==='add-entry' || $operation==='delete-entry') {
        $entry=$input['entry']??[];$key=$entry['intervalKey']??null;$found=false;
        $reschedule=false;
        if ($operation==='add-entry') {
            $key='edit-'.bin2hex(random_bytes(16));
            $entry['intervalKey']=$key;
            $type=$entry['type']??'break';$breakType=$entry['breakType']??null;$approvedTime=$entry['approvedTime']??null;
            if ($type==='break' && !in_array($breakType,['break','short',null],true)) throw new InvalidArgumentException('Unknown break type.');
            if($type==='down' && $approvedTime!==null) trip_edit_duration_milliseconds($approvedTime, true);
            if($type!=='down' && isset($entry['length']) && $entry['length']!==null) trip_edit_duration_milliseconds($entry['length']);
            $events[]=['id'=>null,'event'=>'interval.started','timestamp'=>trip_edit_iso($entry['start']??''),
                'value'=>['type'=>$type,'length'=>$entry['length']??null,'approvedTime'=>$type==='down'?$approvedTime:null,'approvalState'=>$type==='down'?($entry['approvalState']??(is_int($approvedTime)?'approved':'pending')):null,'attributes'=>$type==='break'?['breakType'=>$breakType??'break']:[], 'intervalKey'=>$key]];
            $events[]=['id'=>null,'event'=>'interval.ended','timestamp'=>trip_edit_iso($entry['end']??''),'value'=>['intervalKey'=>$key]];
            $found=true;
        }
        foreach ($events as &$e) {
            if ($key !== null && ($e['value']['intervalKey']??null)===$key) {
                $found=true;
                if ($operation==='delete-entry') {$e['_delete']=true;continue;}
                if ($e['event']==='interval.started') {
                    $reschedule=$reschedule||trip_storage_epoch_ms($e['timestamp'])!==trip_storage_epoch_ms(trip_edit_iso($entry['start']??''))||($entry['type']??null)!==($e['value']['type']??null)||(isset($entry['length'])&&$entry['length']!==($e['value']['length']??null));
                    $e['timestamp']=trip_edit_iso($entry['start']??'');
                    if (!in_array($entry['type']??null,['break','lunch','down'],true)) throw new InvalidArgumentException('Unknown entry type.');
                    $e['value']['type']=$entry['type'];
                    if ($entry['type']==='break') {
                        $breakType=$entry['breakType']??'break';
                        if (!in_array($breakType,['break','short'],true)) throw new InvalidArgumentException('Unknown break type.');
                        $e['value']['attributes']=array_merge($e['value']['attributes']??[],['breakType'=>$breakType]);
                    } elseif (isset($e['value']['attributes']['breakType'])) unset($e['value']['attributes']['breakType']);
                    if (isset($entry['length']) && $entry['length']!==null) {trip_edit_duration_milliseconds($entry['length']);$e['value']['length']=$entry['length'];}
                    if ($entry['type']==='down') {
                        $approvedTime=$entry['approvedTime']??null;
                        if($approvedTime!==null && $approvedTime!=='') trip_edit_duration_milliseconds($approvedTime, true);
                        $e['value']['approvedTime']=$approvedTime;
                        if(array_key_exists('approvalState',$entry)) {if(!in_array($entry['approvalState'],['approved','pending','unapproved'],true))throw new InvalidArgumentException('Unknown Down approval state.');$e['value']['approvalState']=$entry['approvalState'];}
                    } else unset($e['value']['approvedTime']);
                } elseif ($e['event']==='interval.ended' && isset($entry['end'])) {
                    $reschedule=$reschedule||trip_storage_epoch_ms($e['timestamp'])!==trip_storage_epoch_ms(trip_edit_iso($entry['end']));
                    $e['timestamp']=trip_edit_iso($entry['end']);
                }
            } elseif ($key===null && (int)($entry['eventId']??0)===(int)($e['id']??-1)) {
                if ($operation==='delete-entry') throw new InvalidArgumentException('Trip start and end cannot be removed.');
                if (!in_array($e['event'],['trip.started','trip.stopped'],true)) throw new InvalidArgumentException('Select an interval or trip boundary.');
                $found=true;$e['timestamp']=trip_edit_iso($entry['start']??'');
                if ($e['event']==='trip.started') {
                    if(($e['value']['timelineVersion']??null)===2 && isset($e['scheduledStartTime'])){
                        $e['value']['startOffsetMilliseconds']=trip_storage_epoch_ms($e['timestamp'])-trip_storage_epoch_ms($e['scheduledStartTime']);
                        continue;
                    }
                    $anchor=$e['value']['creationAnchor']??null;
                    if (!$anchor) throw new InvalidArgumentException('Trip has no creation anchor.');
                    $ms=(int)round((strtotime($e['timestamp'].' UTC')-strtotime($anchor))*1000);
                    if ($ms<0) throw new InvalidArgumentException('Start must follow the creation date.');
                    $e['value']['startTime']=sprintf('%d:%02d:%02d',intdiv($ms,3600000),intdiv($ms,60000)%60,intdiv($ms,1000)%60);
                }
            }
        }
        unset($e);
        if($reschedule&&$key!==null){
            // Cached phase boundaries describe the old interval. Replay must
            // derive them from the edited start/duration and the current time.
            foreach($events as &$e)if(($e['value']['intervalKey']??null)===$key){
                if($e['event']==='interval.elapsed')$e['_delete']=true;
                if($e['event']==='interval.started'){
                    foreach(array_keys($e['value']['attributes']??[]) as $attribute)if(str_starts_with((string)$attribute,'clock-timer-'))unset($e['value']['attributes'][$attribute]);
                    if($e['value']['type']==='down'){$e['value']['length']=null;$e['value']['startBuffer']=null;$e['value']['endBuffer']=null;}
                }
                if($e['event']==='interval.approval-changed'&&trip_storage_epoch_ms($e['timestamp'])<trip_storage_epoch_ms($entry['start']))$e['timestamp']=trip_edit_iso($entry['start']);
            }
            unset($e);
        }
        if(in_array($operation,['entry','add-entry'],true)) {
            $type=$entry['type']??'';$approvedTime=$entry['approvedTime']??null;$approvalFound=false;
            $approvalState=$entry['approvalState']??null;
            if($approvalState!==null&&!in_array($approvalState,['approved','pending','unapproved'],true))throw new InvalidArgumentException('Unknown Down approval state.');
            foreach($events as &$e)if(($e['event']??'')==='interval.approval-changed'&&($e['value']['intervalKey']??null)===$key){$approvalFound=true;if($type==='down'){if($approvalState!==null){$e['value']['state']=$approvalState;$e['value']['value']=$approvalState==='approved'?$approvedTime:0;}elseif(is_int($approvedTime)){$e['value']['state']='approved';$e['value']['value']=$approvedTime;}}else $e['_delete']=true;}
            unset($e);
            if($type==='down'&&is_int($approvedTime)&&$approvedTime>=0&&!$approvalFound)$events[]=['id'=>null,'event'=>'interval.approval-changed','timestamp'=>trip_edit_iso($entry['end']??$entry['start']??''),'value'=>['intervalKey'=>$key,'state'=>'approved','value'=>$approvedTime]];
        }
        if (!$found) throw new InvalidArgumentException('Entry no longer exists.');
        $events=array_values(array_filter($events,static fn($e)=>!($e['_delete']??false)));
    } else throw new InvalidArgumentException('Unknown edit operation.');
    usort($events,static fn($a,$b)=>strcmp($a['timestamp'],$b['timestamp'])?:((int)$a['id']<=>(int)$b['id']));
    if ($validate) {trip_edit_aggregate($events);if(trip_official_has_history($events))trip_official_assert_completed($events);}
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
        if (($s['breakOnly']??false) && $e['event']==='interval.started' && !in_array($e['value']['type']??'', ['break','lunch'], true)) throw new InvalidArgumentException('Break-only sessions can only contain a break or lunch.');
        $key=$e['value']['intervalKey']??'';
        if($e['event']==='interval.deleted') $deleted[$key]=true;
        if($e['event']==='interval.started') $intervals[$key]=['start'=>$time,'type'=>$e['value']['type'],'length'=>$e['value']['length']??null,'startBuffer'=>$e['value']['startBuffer']??null,'endBuffer'=>$e['value']['endBuffer']??null,'approvedTime'=>$e['value']['approvedTime']??null,'approvalState'=>$e['value']['approvalState']??null,'end'=>null];
        if($e['event']==='interval.ended') {
            if(!isset($intervals[$key])) throw new InvalidArgumentException('Entry end precedes its start.');
            $intervals[$key]['end']=$time;
        }
        if($e['event']==='interval.approval-changed'&&isset($intervals[$key])){$intervals[$key]['approvalState']=$e['value']['state']??'pending';$intervals[$key]['approvedTime']=($e['value']['state']??'')==='approved'?($e['value']['value']??null):(($e['value']['state']??'')==='pending'?null:0);}
    }
    if($start===null || !isset($s['scheduledStart'],$s['creationAnchor']) || (!(($s['breakOnly']??false) === true) && !isset($s['standardTimeMilliseconds']))) throw new InvalidArgumentException('Trip settings are incomplete.');
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
            $planned=0;foreach(['length','startBuffer','endBuffer'] as $field)if(is_int($i[$field]))$planned+=trip_edit_duration_milliseconds($i[$field], true);
            $excluded[]=[max($begin,$i['start']),min($terminal,$i['start']+($planned?:$finish-$i['start']))];
        } elseif($i['type']==='down') {
            $approved=($i['approvalState']??null)==='unapproved'?0:(is_int($i['approvedTime'])?trip_edit_duration_milliseconds($i['approvedTime'], true):$finish-$i['start']);
            $excluded[]=[max($begin,$i['start']),min($terminal,$i['start']+$approved)];
        }
    }
    usort($occupied,static fn($a,$b)=>$a[0]<=>$b[0]);$lastFinish=null;
    foreach($occupied as [$a,$b]) {if($lastFinish!==null && $a<$lastFinish) throw new InvalidArgumentException('Entries cannot overlap.');$lastFinish=$b;}
    usort($excluded,static fn($a,$b)=>$a[0]<=>$b[0]);$last=$begin;$removed=0;
    foreach($excluded as [$a,$b]) {if($b>max($last,$a)) $removed+=$b-max($last,$a);$last=max($last,$b);}
    return ['startTime'=>gmdate('Y-m-d H:i:s',(int)floor($begin/1000)),
        'endTime'=>gmdate('Y-m-d H:i:s',(int)floor($terminal/1000)),
        'standard'=>($s['breakOnly']??false)?null:trip_edit_duration_milliseconds($s['standardTimeMilliseconds']),'counted'=>($s['breakOnly']??false)?0:(int)max(0,round($terminal-$begin-$removed)),
        'nonProduction'=>($s['nonProduction']??false)?1:0];
}
