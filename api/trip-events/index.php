<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

$method = require_method('GET', 'POST');

if ($method === 'GET') {
    $tripId = require_positive_int($_GET, 'tripId');

    $pdo = db();
    require_trip_owner($pdo, $tripId);

    $statement = $pdo->prepare(
        'SELECT id, trip_id, event, `timestamp`, value, client_token, created_at '
        . 'FROM trip_events WHERE trip_id = :trip_id '
        . 'ORDER BY `timestamp` ASC, id ASC'
    );
    $statement->execute([
        ':trip_id' => $tripId,
    ]);

    $events = [];

    while ($row = $statement->fetch()) {
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

        $events[] = [
            'id' => (int) $row['id'],
            'tripId' => (int) $row['trip_id'],
            'event' => (string) $row['event'],
            'timestamp' => (string) $row['timestamp'],
            'value' => $value,
            'clientToken' => $row['client_token'] === null
                ? null
                : (string) $row['client_token'],
            'createdAt' => (string) $row['created_at'],
        ];
    }

    json_response([
        'tripId' => $tripId,
        'events' => $events,
    ]);
}

require_csrf();

$input = json_input();
$tripId = require_positive_int($input, 'tripId');
$event = trim(require_string($input, 'event'));

if ($event === '') {
    api_error(
        'event must not be empty.',
        422,
        'invalid_argument'
    );
}

$timestamp = normalize_datetime(
    require_string($input, 'timestamp'),
    'timestamp'
);

if (!array_key_exists('value', $input)) {
    api_error(
        'value is required.',
        422,
        'invalid_argument'
    );
}

try {
    $valueJson = json_encode(
        $input['value'],
        JSON_THROW_ON_ERROR |
        JSON_UNESCAPED_SLASHES |
        JSON_UNESCAPED_UNICODE
    );
}
catch (Throwable) {
    api_error(
        'value must be JSON serializable.',
        422,
        'invalid_argument'
    );
}

$clientToken = $input['clientToken'] ?? null;

if ($clientToken !== null) {
    if (!is_string($clientToken)) {
        api_error(
            'clientToken must be a UUID string.',
            422,
            'invalid_argument'
        );
    }

    $clientToken = strtolower(trim($clientToken));

    if (
        !preg_match(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/',
            $clientToken
        )
    ) {
        api_error(
            'clientToken must be a UUID string.',
            422,
            'invalid_argument'
        );
    }
}

$eventId = audited_write(
    static function (PDO $pdo) use (
        $tripId,
        $event,
        $timestamp,
        $valueJson,
        $clientToken
    ): int {
        require_trip_owner($pdo, $tripId);

        if ($clientToken !== null) {
            $existing = $pdo->prepare(
                'SELECT e.id, e.trip_id '
                . 'FROM trip_events e '
                . 'INNER JOIN trips t ON t.id = e.trip_id '
                . 'WHERE e.client_token = :client_token '
                . 'AND t.user_id = :user_id '
                . 'LIMIT 1'
            );
            $existing->execute([
                ':client_token' => $clientToken,
                ':user_id' => authenticated_user_id(),
            ]);

            $row = $existing->fetch();

            if ($row) {
                if ((int) $row['trip_id'] !== $tripId) {
                    api_error(
                        'clientToken already belongs to another trip.',
                        409,
                        'event_token_conflict'
                    );
                }

                return (int) $row['id'];
            }
        }

        $statement = $pdo->prepare(
            'INSERT INTO trip_events '
            . '(trip_id, event, `timestamp`, value, client_token) '
            . 'VALUES (:trip_id, :event, :timestamp, :value, :client_token)'
        );
        $statement->execute([
            ':trip_id' => $tripId,
            ':event' => $event,
            ':timestamp' => $timestamp,
            ':value' => $valueJson,
            ':client_token' => $clientToken,
        ]);

        return (int) $pdo->lastInsertId();
    }
);

json_response([
    'tripId' => $tripId,
    'eventId' => $eventId,
], 201);
