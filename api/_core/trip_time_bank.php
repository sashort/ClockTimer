<?php
declare(strict_types=1);

// Read projection only. Factual events and persisted legacy counted durations
// remain unchanged; unused allowance is bank credit, never negative work.
function trip_time_bank_projection(array $trip, array $events): ?array
{
    if (!empty($trip['breakOnly']) || !empty($trip['running'])) return null;
    $instant = static function ($value): ?int {
        if (!is_string($value) || $value === '') return null;
        try { $date = new DateTimeImmutable($value, new DateTimeZone('UTC')); }
        catch (Exception $error) { return null; }
        return (int) $date->format('U') * 1000 + (int) $date->format('v');
    };
    $duration = static fn($value): int => is_int($value) && $value >= 0 ? $value : 0;
    $started = null; $stopped = null; $ends = []; $deleted = []; $approvals = [];
    foreach ($events as $event) {
        $value = $event['value'] ?? []; $key = $value['intervalKey'] ?? null;
        if ($event['event'] === 'trip.started') $started ??= $event;
        if ($event['event'] === 'trip.stopped') $stopped = $event;
        if ($key && $event['event'] === 'interval.ended') $ends[$key] = $event;
        if ($key && $event['event'] === 'interval.deleted') $deleted[$key] = true;
        if ($key && $event['event'] === 'interval.approval-changed') $approvals[$key] = $value;
    }
    if (!$started || !$stopped || !empty($started['value']['breakOnly'])) return null;
    $begin = $instant($trip['startTime'] ?? $started['timestamp']);
    $finish = $instant($trip['endTime'] ?? $stopped['timestamp']);
    if ($begin === null || $finish === null || $finish < $begin) return null;
    $segments = []; $credit = 0;
    foreach ($events as $event) {
        if ($event['event'] !== 'interval.started') continue;
        $value = $event['value'] ?? []; $key = $value['intervalKey'] ?? null;
        if (!$key || isset($deleted[$key])) continue;
        $type = strtolower((string) ($value['type'] ?? ''));
        if (!in_array($type, ['break','lunch','down','buffer'], true)) continue;
        $left = $instant($event['timestamp']);
        $right = isset($ends[$key]) ? $instant($ends[$key]['timestamp']) : $finish;
        if ($left === null || $right === null || $right < $left) return null;
        if ($left >= $finish || $right <= $begin) continue;
        $excluded = $right - $left;
        if ($type === 'down') {
            $approval = $approvals[$key] ?? null;
            if (($approval['state'] ?? null) === 'unapproved') $excluded = 0;
            elseif (($approval['state'] ?? null) === 'approved' && is_int($approval['value'] ?? null)) $excluded = $duration($approval['value']);
            elseif (is_int($value['approvedTime'] ?? null)) $excluded = $duration($value['approvedTime']);
        }
        $segments[] = [max($begin,$left),min($finish,$left+$excluded)];
        if (isset($ends[$key]) && in_array($type,['break','lunch'],true) && is_int($value['length'] ?? null))
            $credit += max(0,$value['length']+$duration($value['startBuffer'] ?? null)+$duration($value['endBuffer'] ?? null)-($right-$left));
    }
    $anchor = $instant($started['value']['creationAnchor'] ?? null);
    if ($anchor !== null && preg_match('/^(\d+):(\d+):(\d+(?:\.\d+)?)$/D',(string)($started['value']['scheduledStart'] ?? ''),$match)) {
        $scheduled = $anchor + (int) round(((int)$match[1]*3600+(int)$match[2]*60+(float)$match[3])*1000);
        if ($scheduled > $begin && $scheduled <= $finish) $segments[] = [$begin,$scheduled];
    }
    if (!$credit) return null;
    usort($segments,static fn($a,$b)=>$a[0]<=>$b[0]);$excluded=0;$cursor=$begin;
    foreach ($segments as [$left,$right]) if ($right > max($cursor,$left)) {$excluded += $right-max($cursor,$left);$cursor=$right;}
    $productive=max(0,$finish-$begin-$excluded);$balance=$productive-$credit;
    return ['productiveTimeMilliseconds'=>$productive,'allowanceCreditMilliseconds'=>$credit,
        'countedTimeBalanceMilliseconds'=>$balance,'bankCreditCarryMilliseconds'=>max(0,-$balance)];
}
