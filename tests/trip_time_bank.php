<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_core/trip_time_bank.php';
$fixture=json_decode(file_get_contents(__DIR__.'/fixtures/early-break-bank.json'),true,512,JSON_THROW_ON_ERROR);
$result=trip_time_bank_projection($fixture['trip'],$fixture['trip']['events']);
foreach (['productiveTimeMilliseconds','allowanceCreditMilliseconds','countedTimeBalanceMilliseconds','bankCreditCarryMilliseconds'] as $key)
 if ($result[$key]!==$fixture['expected'][$key]) throw new RuntimeException($key.' mismatch');
if ($fixture['trip']['countedTimeMilliseconds']!==0) throw new RuntimeException('Saved row was mutated');
$early=$fixture['trip'];$early['events'][0]['value']['scheduledStart']='12:01:00';
$expected=trip_time_bank_projection($early,$early['events']);
$early['events'][0]['scheduledStartTime']='2026-01-01T12:01:00.000Z';
$early['events'][0]['value']['scheduledStartOffsetMilliseconds']=0;
unset($early['events'][0]['value']['creationAnchor'],$early['events'][0]['value']['scheduledStart']);
if(trip_time_bank_projection($early,$early['events'])!==$expected)throw new RuntimeException('Canonical early-start bank projection differs from the historical calculation');
echo "PASS server bank/work projection matches shared regression fixture without database writes\n";
