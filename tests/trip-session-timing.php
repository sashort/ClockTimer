<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_core/trip_session_timing.php';
foreach ([['breakOnly'=>true],['breakOnly'=>true,'standardTimeMilliseconds'=>null]] as $input) {
    if (TripSessionTimingInput::parse($input)!==['breakOnly'=>true,'standardTimeMilliseconds'=>null]) throw new RuntimeException('Break-only null standard rejected.');
}
foreach ([600000,'600000'] as $standard) {
    if (TripSessionTimingInput::parse(['standardTimeMilliseconds'=>$standard])!==['breakOnly'=>false,'standardTimeMilliseconds'=>600000]) throw new RuntimeException('Normal standard rejected.');
}
foreach ([[],['standardTimeMilliseconds'=>0],['standardTimeMilliseconds'=>null],['breakOnly'=>'true'],['breakOnly'=>true,'standardTimeMilliseconds'=>600000]] as $invalid) {
    try { TripSessionTimingInput::parse($invalid); }
    catch (InvalidArgumentException $error) { continue; }
    throw new RuntimeException('Invalid timing accepted.');
}
$preflight=file_get_contents(__DIR__.'/../api/command-check/index.php');
if (!str_contains($preflight,'require_trip_session_timing($command)')) throw new RuntimeException('Preflight must use shared session timing validation.');
echo "PASS shared preflight/save timing validation: null standard only for break-only; positive standard for ordinary trips\n";
