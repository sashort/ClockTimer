<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/_core/response.php';
require_once __DIR__ . '/../api/_core/command_checks.php';
function expect(bool $value, string $message): void {if (!$value) throw new RuntimeException($message);}
function command(string $event, array $value = []): array {return ['event'=>$event,'timestamp'=>'2026-10-06T12:10:00Z','value'=>$value];}
$start=['event'=>'trip.started','timestamp'=>'2026-10-06T12:00:00Z','value'=>[]];
$interval=['event'=>'interval.started','timestamp'=>'2026-10-06T12:05:00Z','value'=>['type'=>'lunch','intervalKey'=>'original','length'=>1800000]];
$end=['event'=>'interval.ended','timestamp'=>'2026-10-06T12:06:00Z','value'=>['intervalKey'=>'original']];
$stop=['event'=>'trip.stopped','timestamp'=>'2026-10-06T12:07:00Z','value'=>[]];
$new=command('interval.started',['type'=>'down','intervalKey'=>'new','length'=>null]);
expect(check_trip_event_command([],command('trip.started'))['accepted'],'first trip start accepted');
expect(!check_trip_event_command([$start],command('trip.started'))['accepted'],'duplicate trip start rejected');
expect(!check_trip_event_command([],$new)['accepted'],'interval without trip rejected');
expect(!check_trip_event_command([$start,$interval],$new)['accepted'],'different interval groups conflict');
expect(check_trip_event_command([$start,$interval,$end],$new)['accepted'],'ended interval permits next command');
expect(!check_trip_event_command([$start,$stop],$new)['accepted'],'interval after stop rejected');
expect(!check_trip_event_command([$start,$stop],command('trip.stopped'))['accepted'],'duplicate stop rejected');
expect(!check_trip_event_command([$start],command('interval.ended',['intervalKey'=>'missing']))['accepted'],'missing target rejected');
expect(!check_trip_event_command([$start,$interval,$end],command('interval.ended',['intervalKey'=>'original']))['accepted'],'duplicate interval end rejected');
$before=serialize([$start,$interval]);check_trip_event_command([$start,$interval],$new);
expect(serialize([$start,$interval])===$before,'validation is read-only');
echo "PASS server command checks for starts, stops, interval conflicts, missing targets and read-only validation\n";
