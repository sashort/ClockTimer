<?php
declare(strict_types=1);

function normalize_trip_event_view(mixed $value): string
{
    if ($value === null || $value === '') return 'log';

    if (!is_string($value)) {
        api_error('view must be log or reconstruction.', 422, 'invalid_argument');
    }

    $view = strtolower(trim($value));

    if (!in_array($view, ['log', 'reconstruction'], true)) {
        api_error('view must be log or reconstruction.', 422, 'invalid_argument');
    }

    return $view;
}

function legacy_trip_event_duration_milliseconds(mixed $value): ?int
{
    if (is_int($value)) {
        return $value >= 0
            ? $value
            : null;
    }

    if (!is_string($value)) {
        return null;
    }

    $text = trim($value);

    if (
        !preg_match(
            '/^(?:(\d+):)?([0-5]?\d):([0-5]\d)(?:\.(\d{1,3}))?$/D',
            $text,
            $match
        )
    ) {
        return null;
    }

    return
        (
            (int) ($match[1] ?? 0) * 3600 +
            (int) $match[2] * 60 +
            (int) $match[3]
        ) * 1000 +
        (int) str_pad(
            $match[4] ?? '',
            3,
            '0'
        );
}

function normalize_trip_event_duration_values(
    string $event,
    mixed $value
): mixed {
    if (!is_array($value)) {
        return $value;
    }

    if ($event === 'trip.started') {
        $milliseconds =
            legacy_trip_event_duration_milliseconds(
                $value['standardTimeMilliseconds'] ??
                    $value['standardTime'] ??
                    null
            );

        if ($milliseconds !== null) {
            $value['standardTimeMilliseconds'] =
                $milliseconds;
            unset($value['standardTime']);
        }
    }
    elseif ($event === 'trip.standard-time-changed') {
        $milliseconds =
            legacy_trip_event_duration_milliseconds(
                $value['value'] ??
                    null
            );

        if ($milliseconds !== null) {
            $value['value'] =
                $milliseconds;
        }
    }
    elseif ($event === 'interval.started') {
        foreach (
            [
                'length',
                'startBuffer',
                'endBuffer',
                'approvedTime'
            ] as $field
        ) {
            if (
                !array_key_exists(
                    $field,
                    $value
                ) ||
                $value[$field] === null
            ) {
                continue;
            }

            $milliseconds =
                legacy_trip_event_duration_milliseconds(
                    $value[$field]
                );

            if ($milliseconds !== null) {
                $value[$field] =
                    $milliseconds;
            }
        }

        if (is_array($value['attributes'] ?? null)) {
            foreach (
                [
                    'approved',
                    'unapproved'
                ] as $field
            ) {
                if (
                    !array_key_exists(
                        $field,
                        $value['attributes']
                    )
                ) {
                    continue;
                }

                $milliseconds =
                    legacy_trip_event_duration_milliseconds(
                        $value['attributes'][$field]
                    );

                if ($milliseconds !== null) {
                    $value['attributes'][$field] =
                        $milliseconds;
                }
            }
        }
    }
    elseif ($event === 'interval.approval-changed') {
        $milliseconds =
            legacy_trip_event_duration_milliseconds(
                $value['value'] ??
                    null
            );

        if ($milliseconds !== null) {
            $value['value'] =
                $milliseconds;
        }
    }

    return $value;
}

function require_trip_event_type_id(PDO $pdo, string $event): int
{
    $statement = $pdo->prepare(
        'SELECT id FROM event_types WHERE name = :name LIMIT 1'
    );
    $statement->execute([':name' => $event]);

    $id = (int) ($statement->fetchColumn() ?: 0);

    if ($id < 1) {
        api_error('Unknown trip event type.', 422, 'invalid_event_type');
    }

    return $id;
}

function decode_trip_event_row(array $row): array
{
    try {
        $value = json_decode(
            (string) $row['value'],
            true,
            512,
            JSON_THROW_ON_ERROR
        );
    }
    catch (Throwable) {
        api_error(
            'Stored trip event value is invalid JSON.',
            500,
            'invalid_event_value'
        );
    }

    $value =
        normalize_trip_event_duration_values(
            (string) $row['event'],
            $value
        );

    return [
        'id' => (int) $row['id'],
        'tripId' => (int) $row['trip_id'],
        'eventTypeId' => (int) $row['event_type_id'],
        'event' => (string) $row['event'],
        'timestamp' => (string) $row['timestamp'],
        'value' => $value,
        'clientToken' => $row['client_token'] === null
            ? null
            : (string) $row['client_token'],
        'createdAt' => (string) $row['created_at'],
        '_reconstruction' => ((int) $row['reconstruction']) === 1,
    ];
}

function public_trip_event(array $event): array
{
    unset($event['_reconstruction']);
    return $event;
}

function project_trip_events_for_reconstruction(array $events): array
{
    $deletedIntervals = [];

    foreach ($events as $event) {
        if (($event['event'] ?? null) !== 'interval.deleted') continue;

        $key = trim((string) ($event['value']['intervalKey'] ?? ''));

        if ($key !== '') {
            $deletedIntervals[$key] = true;
        }
    }

    $result = [];

    foreach ($events as $event) {
        if (($event['_reconstruction'] ?? false) !== true) continue;

        if (
            ($event['event'] ?? null) === 'interval.started' ||
            ($event['event'] ?? null) === 'interval.ended'
        ) {
            $key = trim((string) ($event['value']['intervalKey'] ?? ''));

            if ($key !== '' && isset($deletedIntervals[$key])) {
                continue;
            }
        }

        $result[] = public_trip_event($event);
    }

    return $result;
}

function fetch_trip_events_grouped(
    PDO $pdo,
    array $tripIds,
    string $view = 'log'
): array {
    $view = normalize_trip_event_view($view);
    $normalizedIds = [];

    foreach ($tripIds as $tripId) {
        $id = (int) $tripId;
        if ($id > 0) $normalizedIds[$id] = $id;
    }

    if ($normalizedIds === []) return [];

    $parameters = [];
    $placeholders = [];

    foreach (array_values($normalizedIds) as $index => $tripId) {
        $placeholder = ':trip_id_' . $index;
        $placeholders[] = $placeholder;
        $parameters[$placeholder] = $tripId;
    }

    $statement = $pdo->prepare(
        'SELECT e.id, e.trip_id, e.event_type_id, et.name AS event, '
        . 'et.reconstruction, e.timestamp, e.value, e.client_token, e.created_at '
        . 'FROM trip_events e '
        . 'INNER JOIN event_types et ON et.id = e.event_type_id '
        . 'WHERE e.trip_id IN (' . implode(', ', $placeholders) . ') '
        . 'ORDER BY e.trip_id ASC, e.timestamp ASC, e.id ASC'
    );
    $statement->execute($parameters);

    $grouped = [];
    foreach (array_values($normalizedIds) as $tripId) {
        $grouped[$tripId] = [];
    }

    while ($row = $statement->fetch()) {
        $event = decode_trip_event_row($row);
        $grouped[$event['tripId']][] = $event;
    }

    foreach ($grouped as $tripId => $events) {
        $grouped[$tripId] =
            $view === 'reconstruction'
                ? project_trip_events_for_reconstruction($events)
                : array_map('public_trip_event', $events);
    }

    return $grouped;
}

function fetch_trip_events(PDO $pdo, int $tripId, string $view = 'log'): array
{
    $grouped = fetch_trip_events_grouped($pdo, [$tripId], $view);
    return $grouped[$tripId] ?? [];
}
