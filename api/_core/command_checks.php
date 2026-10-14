<?php
declare(strict_types=1);

/** Read-only validation of persisted state transitions; never changes storage. */
function check_trip_event_command(array $events, array $input): array
{
    $name = require_string($input, 'event');
    $timestamp = normalize_datetime(require_string($input, 'timestamp'), 'timestamp');
    $value = $input['value'] ?? null;
    if (!is_array($value)) return ['accepted' => false, 'reason' => 'Event value must be an object.'];
    $now = (float) (new DateTimeImmutable($timestamp))->format('U.u') * 1000;
    $started = false;
    $running = false;
    $intervals = [];
    foreach ($events as $event) {
        if (!empty($input['clientToken']) && ($event['clientToken'] ?? null) === $input['clientToken']) {
            return ['accepted' => true]; // An already accepted append can be retried.
        }
        $at = (float) (new DateTimeImmutable($event['timestamp']))->format('U.u') * 1000;
        if ($at > $now) continue;
        $existing = $event['value'] ?? [];
        if ($event['event'] === 'trip.started') {$started = true; $running = true;}
        if ($event['event'] === 'trip.stopped') $running = false;
        $key = (string) ($existing['intervalKey'] ?? $event['id'] ?? '');
        if ($event['event'] === 'interval.started') {
            $length = $existing['length'] ?? null;
            $intervals[$key] = ['ended' => false, 'end' => $length === null ? INF : $at + (float) $length
                + (float) ($existing['startBuffer'] ?? 0) + (float) ($existing['endBuffer'] ?? 0)];
        }
        if ($event['event'] === 'interval.ended' && isset($intervals[$key])) $intervals[$key]['ended'] = true;
        if ($event['event'] === 'interval.deleted') unset($intervals[$key]);
    }
    $reject = static fn(string $reason): array => ['accepted' => false, 'reason' => $reason];
    if ($name === 'trip.started') return $started ? $reject('The trip has already started.') : ['accepted' => true];
    if (!$started) return $reject('The trip has not started.');
    if ($name === 'trip.stopped' && !$running) return $reject('The trip has already stopped.');
    if ($name === 'interval.started') {
        if (!$running) return $reject('A running trip is required.');
        if (!in_array(strtolower((string) ($value['type'] ?? '')), ['break', 'lunch', 'down'], true)) return $reject('Unknown interval type.');
        foreach (['length', 'startBuffer', 'endBuffer'] as $field) {
            if (isset($value[$field]) && (!is_numeric($value[$field]) || (float) $value[$field] < 0)) return $reject('Invalid interval duration.');
        }
        if (empty($value['intervalKey'])) return $reject('An interval key is required.');
        foreach ($intervals as $interval) {
            if (!$interval['ended'] && $interval['end'] > $now) return $reject('An interval is already active.');
        }
    } elseif (str_starts_with($name, 'interval.')) {
        $key = (string) ($value['intervalKey'] ?? '');
        if (!isset($intervals[$key])) return $reject('The interval does not exist.');
        if ($name === 'interval.ended' && $intervals[$key]['ended']) return $reject('The interval has already ended.');
    }
    return ['accepted' => true];
}

function require_accepted_state_command(array $decision): void
{
    if (($decision['accepted'] ?? false) !== true) {
        api_error((string) ($decision['reason'] ?? 'The command was rejected.'), 409, 'command_rejected');
    }
}
