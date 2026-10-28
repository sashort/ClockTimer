<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_core/trip_time_bank.php';
$fixture=json_decode(file_get_contents(__DIR__.'/fixtures/early-break-bank.json'),true,512,JSON_THROW_ON_ERROR);
$result=trip_time_bank_projection($fixture['trip'],$fixture['trip']['events']);
foreach (['productiveTimeMilliseconds','allowanceCreditMilliseconds','countedTimeBalanceMilliseconds','bankCreditCarryMilliseconds'] as $key)
 if ($result[$key]!==$fixture['expected'][$key]) throw new RuntimeException($key.' mismatch');
if ($fixture['trip']['countedTimeMilliseconds']!==0) throw new RuntimeException('Saved row was mutated');
echo "PASS server bank/work projection matches shared regression fixture without database writes\n";
