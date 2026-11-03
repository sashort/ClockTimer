<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_core/database.php';
require_once __DIR__.'/../api/_core/migrations.php';
require_once __DIR__.'/../api/_core/trip_storage.php';
require_once __DIR__.'/../api/_core/trip_events.php';
$dsn=getenv('CLOCKTIMER_TEST_DSN')?:'';
if(!str_contains($dsn,'dbname=clocktimer_test;'))throw new RuntimeException('An isolated clocktimer_test database is required.');
$pdo=new PDO($dsn,'root',getenv('CLOCKTIMER_TEST_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
function verify(bool $condition,string $message):void{if(!$condition)throw new RuntimeException($message);echo "PASS $message\n";}
// This database is exclusively the CI fixture, never an application database.
$pdo->exec('SET FOREIGN_KEY_CHECKS=0');
foreach($pdo->query('SHOW FULL TABLES')->fetchAll(PDO::FETCH_NUM) as $table)$pdo->exec('DROP '.($table[1]==='VIEW'?'VIEW':'TABLE').' `'.str_replace('`','``',$table[0]).'`');
$pdo->exec('SET FOREIGN_KEY_CHECKS=1');
foreach(explode(';',file_get_contents(__DIR__.'/fixtures/trip-offset-legacy.sql')) as $sql)if(trim($sql)!=='')$pdo->exec($sql);
$pdo->exec("INSERT INTO users (id,first_name,last_name,username,password_hash) VALUES (1,'Test','User','test','unused')");
$pdo->exec("INSERT INTO trips (id,user_id,start_time,end_time,standard_time_ms,counted_time_ms,non_production,break_only) VALUES (1,1,'2026-11-01 05:59:30.125','2026-11-01 07:30:00.375',7200000,5430250,0,0),(2,1,'2026-11-01 09:00:00.000','2026-11-01 09:20:00.000',NULL,0,0,1)");
$insert=$pdo->prepare('INSERT INTO trip_events (trip_id,event_type_id,timestamp,value) VALUES (?,?,?,?)');
$insert->execute([1,1,'2026-11-01 05:59:30.125',json_encode(['timelineVersion'=>2,'scheduledStartTime'=>'2026-11-01T06:00:00.000Z','creationOffsetMilliseconds'=>-60000,'startOffsetMilliseconds'=>-29875,'scheduledStartOffsetMilliseconds'=>0,'standardTimeMilliseconds'=>7200000,'creationAnchor'=>'2026-11-01T04:00:00.000Z','creationTime'=>'1:59:00','scheduledStart'=>'2:00:00','startTime'=>'1:59:30.125'])]);
$insert->execute([1,10,'2026-11-01 06:10:00.250',json_encode(['intervalKey'=>'down','type'=>'down','attributes'=>['clock-timer-actual-end'=>'2026-11-01T06:20:00.500Z']])]);
$insert->execute([1,11,'2026-11-01 06:20:00.500',json_encode(['intervalKey'=>'down'])]);
$insert->execute([1,2,'2026-11-01 07:30:00.375','{}']);
$insert->execute([2,1,'2026-11-01 09:00:00.000',json_encode(['breakOnly'=>true,'creationAnchor'=>'2026-11-01T00:00:00Z','creationTime'=>'9:00:00','startTime'=>'9:00:00','scheduledStart'=>'9:00:00'])]);
$before=$pdo->query('SELECT id,timestamp,created_at,client_token FROM trip_events ORDER BY id')->fetchAll();
$directory=sys_get_temp_dir().'/clocktimer-offset-'.bin2hex(random_bytes(6));mkdir($directory);
copy(__DIR__.'/../migrations/016_trip_offsets.php',$directory.'/016_trip_offsets.php');
try {
    apply_migration($pdo,'016_trip_offsets',0,$directory);
    verify(trip_storage_uses_offsets($pdo),'canonical schema detected');
    $trip=$pdo->query('SELECT * FROM trips WHERE id=1')->fetch();
    verify($trip['scheduled_start_time']==='2026-11-01 06:00:00.000'&&(int)$trip['start_offset_ms']===-29875,'scheduled start and negative offsets preserve repeated-hour instants');
    verify($pdo->query('SELECT production FROM trips WHERE id=2')->fetchColumn()==='break-only','break-only classification uses the production enum');
    $after=$pdo->query('SELECT id,timestamp,created_at,client_token FROM trip_event_datetime_projection ORDER BY id')->fetchAll();
    verify($before===$after,'migration preserves every instant, identity, server recording time and client token');
    $value=json_decode($pdo->query('SELECT value FROM trip_events WHERE id=1')->fetchColumn(),true);
    verify(!isset($value['creationAnchor'],$value['scheduledStartTime'])&&$value['startOffsetMilliseconds']===-29875,'event payload stores offsets without independent datetime anchors');
    verify((int)$pdo->query('SELECT COUNT(*) FROM trip_timeline_migration_archive')->fetchColumn()===2,'original rows archived before conversion');
    verify(apply_migration($pdo,'016_trip_offsets',0,$directory)['alreadyApplied'],'recorded migration safely skips on replay');
    $pdo->exec("SET @audit_user_id=1,@audit_change_id='offset-test',@audit_sequence=0");
    try{$pdo->exec('UPDATE trip_events SET offset_ms=0 WHERE id=1');throw new RuntimeException('Immutable event update accepted');}catch(PDOException){}
    $pdo->beginTransaction();
    trip_storage_update($pdo,1,['scheduled_start_time'=>'2026-11-01 07:00:00.000'],1);
    $pdo->commit();
    verify($before===$pdo->query('SELECT id,timestamp,created_at,client_token FROM trip_event_datetime_projection ORDER BY id')->fetchAll(),'scheduled-start rebase preserves all event instants');
    $trip2=$pdo->query('SELECT * FROM trip_datetime_projection WHERE id=1')->fetch();
    verify($trip2['start_time']==='2026-11-01 05:59:30.125'&&$trip2['end_time']==='2026-11-01 07:30:00.375'&&(int)$trip2['start_offset_ms']===-3629875,'trip start/end instants survive rebase');
    $value=json_decode($pdo->query('SELECT value FROM trip_events WHERE id=2')->fetchColumn(),true);
    verify($value['attributes']['clock-timer-actual-end-offset-ms']===-2399500,'nested interval offsets rebase with their parent');
    $pdo->beginTransaction();trip_storage_update($pdo,1,['scheduled_start_time'=>'2026-11-01 08:00:00.000'],1);$pdo->rollBack();
    verify($pdo->query('SELECT scheduled_start_time FROM trips WHERE id=1')->fetchColumn()==='2026-11-01 07:00:00.000','rebase rolls back atomically');
    $events=fetch_trip_events($pdo,1);
    verify(count($events)===4&&$events[0]['scheduledStartTime']==='2026-11-01T07:00:00.000Z','API projection derives timestamps and publishes one canonical anchor');
    verify(!array_intersect(['creationAnchor','creationTime','startTime','scheduledStart'],array_keys($events[0]['value'])),'canonical API omits legacy midnight anchor and clock aliases');
    $command=trip_storage_command($pdo,'trip-events',['scheduledStartTime'=>'2026-11-01T07:00:00Z','offsetMilliseconds'=>-1]);
    verify($command['timestamp']==='2026-11-01 06:59:59.999','negative millisecond command offsets retain exact precision');
    try{trip_storage_command($pdo,'trips',['startTime'=>'2026-11-01T07:00:00Z']);throw new RuntimeException('Outdated writer accepted');}catch(InvalidArgumentException $e){verify(str_contains($e->getMessage(),'Reload'),'outdated clients must reload before writing an orphan trip');}
    echo "PASS MariaDB offset migration and audited storage lifecycle\n";
}finally{foreach(glob($directory.'/*')?:[] as $file)unlink($file);rmdir($directory);}
