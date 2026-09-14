<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

$method = require_method('GET', 'POST', 'PATCH', 'DELETE');

if ($method === 'GET') {
    $userId = authenticated_user_id();

    $startInput = $_GET['startTime'] ?? null;
    $endInput = $_GET['endTime'] ?? null;

    if (!is_string($startInput) || !is_string($endInput)) {
        api_error('startTime and endTime are required.', 422, 'invalid_argument');
    }

    $startTime = normalize_datetime($startInput, 'startTime');
    $endTime = normalize_datetime($endInput, 'endTime');

    if ($endTime <= $startTime) {
        api_error('endTime must be later than startTime.', 422, 'invalid_argument');
    }

    $excludeTripId = null;
    if (isset($_GET['excludeTripId']) && $_GET['excludeTripId'] !== '') {
        $excludeTripId = require_positive_int(
            ['excludeTripId' => $_GET['excludeTripId']],
            'excludeTripId'
        );
    }

    $sql =
        'SELECT COUNT(*) AS trip_count, '
        . 'COALESCE(SUM(standard_time_ms), 0) AS standard_time_ms, '
        . 'COALESCE(SUM(TIMESTAMPDIFF(MICROSECOND, start_time, end_time)), 0) AS actual_time_us '
        . 'FROM trips '
        . 'WHERE user_id = :user_id '
        . 'AND start_time >= :start_time '
        . 'AND start_time <= :end_time';

    $parameters = [
        ':user_id' => $userId,
        ':start_time' => $startTime,
        ':end_time' => $endTime,
    ];

    if ($excludeTripId !== null) {
        $sql .= ' AND id <> :exclude_trip_id';
        $parameters[':exclude_trip_id'] = $excludeTripId;
    }

    $statement = db()->prepare($sql);
    $statement->execute($parameters);
    $row = $statement->fetch();

    $actualMicroseconds = (int) ($row['actual_time_us'] ?? 0);

    json_response([
        'tripCount' => (int) ($row['trip_count'] ?? 0),
        'standardTimeMilliseconds' => (int) ($row['standard_time_ms'] ?? 0),
        'actualTimeMilliseconds' => intdiv($actualMicroseconds, 1000),
    ]);
}

$input = json_input();
require_csrf();

if ($method === 'POST') {
    $startTime = normalize_datetime(require_string($input, 'startTime'), 'startTime');
    $endTime = normalize_datetime(require_string($input, 'endTime'), 'endTime');
    $standardTimeMilliseconds = require_positive_int($input, 'standardTimeMilliseconds');

    if ($endTime <= $startTime) {
        api_error('endTime must be later than startTime.', 422, 'invalid_argument');
    }

    $tripId = audited_write(
        static function (PDO $pdo) use ($startTime, $endTime, $standardTimeMilliseconds): int {
            $statement = $pdo->prepare(
                'INSERT INTO trips (user_id, start_time, end_time, standard_time_ms) '
                . 'VALUES (:user_id, :start_time, :end_time, :standard_time_ms)'
            );
            $statement->execute([
                ':user_id' => authenticated_user_id(),
                ':start_time' => $startTime,
                ':end_time' => $endTime,
                ':standard_time_ms' => $standardTimeMilliseconds,
            ]);
            return (int) $pdo->lastInsertId();
        }
    );

    json_response(['tripId' => $tripId], 201);
}

$tripId = require_positive_int($input, 'tripId');

if ($method === 'DELETE') {
    audited_write(static function (PDO $pdo) use ($tripId): void {
        require_trip_owner($pdo, $tripId);

        $deleteAttributes = $pdo->prepare(
            'DELETE a FROM attributes a INNER JOIN intervals i ON i.id = a.interval_id WHERE i.trip_id = :trip_id'
        );
        $deleteAttributes->execute([':trip_id' => $tripId]);

        $deleteIntervals = $pdo->prepare('DELETE FROM intervals WHERE trip_id = :trip_id');
        $deleteIntervals->execute([':trip_id' => $tripId]);

        $deleteTrip = $pdo->prepare('DELETE FROM trips WHERE id = :trip_id AND user_id = :user_id');
        $deleteTrip->execute([
            ':trip_id' => $tripId,
            ':user_id' => authenticated_user_id(),
        ]);
    });

    json_response(['tripId' => $tripId]);
}

$action = require_string($input, 'action');

if ($action === 'stop') {
    $endTime = normalize_datetime(require_string($input, 'endTime'), 'endTime');
    $standardTimeMilliseconds = require_positive_int($input, 'standardTimeMilliseconds');

    audited_write(
        static function (PDO $pdo) use ($tripId, $endTime, $standardTimeMilliseconds): void {
            $trip = require_trip_owner($pdo, $tripId);

            if ($endTime <= (string) $trip['start_time']) {
                api_error('endTime must be later than the trip start.', 422, 'invalid_argument');
            }

            $statement = $pdo->prepare(
                'UPDATE trips SET end_time = :end_time, standard_time_ms = :standard_time_ms '
                . 'WHERE id = :trip_id AND user_id = :user_id'
            );
            $statement->execute([
                ':end_time' => $endTime,
                ':standard_time_ms' => $standardTimeMilliseconds,
                ':trip_id' => $tripId,
                ':user_id' => authenticated_user_id(),
            ]);
        }
    );

    json_response(['tripId' => $tripId]);
}

if ($action === 'reset') {
    $startTime = normalize_datetime(require_string($input, 'startTime'), 'startTime');
    $endTime = normalize_datetime(require_string($input, 'endTime'), 'endTime');
    $standardTimeMilliseconds = require_positive_int($input, 'standardTimeMilliseconds');

    if ($endTime <= $startTime) {
        api_error('endTime must be later than startTime.', 422, 'invalid_argument');
    }

    audited_write(
        static function (PDO $pdo) use ($tripId, $startTime, $endTime, $standardTimeMilliseconds): void {
            require_trip_owner($pdo, $tripId);

            $deleteAttributes = $pdo->prepare(
                'DELETE a FROM attributes a INNER JOIN intervals i ON i.id = a.interval_id WHERE i.trip_id = :trip_id'
            );
            $deleteAttributes->execute([':trip_id' => $tripId]);

            $deleteIntervals = $pdo->prepare('DELETE FROM intervals WHERE trip_id = :trip_id');
            $deleteIntervals->execute([':trip_id' => $tripId]);

            $updateTrip = $pdo->prepare(
                'UPDATE trips SET start_time = :start_time, end_time = :end_time, '
                . 'standard_time_ms = :standard_time_ms '
                . 'WHERE id = :trip_id AND user_id = :user_id'
            );
            $updateTrip->execute([
                ':start_time' => $startTime,
                ':end_time' => $endTime,
                ':standard_time_ms' => $standardTimeMilliseconds,
                ':trip_id' => $tripId,
                ':user_id' => authenticated_user_id(),
            ]);
        }
    );

    json_response(['tripId' => $tripId]);
}

api_error('Unknown trip action.', 422, 'invalid_action');
