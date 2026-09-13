<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

$method = require_method('POST', 'PATCH', 'DELETE');
$input = json_input();

if ($method === 'POST') {
    $startTime = normalize_datetime(require_string($input, 'startTime'), 'startTime');
    $endTime = normalize_datetime(require_string($input, 'endTime'), 'endTime');

    if ($endTime <= $startTime) {
        api_error('endTime must be later than startTime.', 422, 'invalid_argument');
    }

    $tripId = audited_write(static function (PDO $pdo) use ($startTime, $endTime): int {
        $statement = $pdo->prepare(
            'INSERT INTO trips (user_id, start_time, end_time) VALUES (:user_id, :start_time, :end_time)'
        );
        $statement->execute([
            ':user_id' => authenticated_user_id(),
            ':start_time' => $startTime,
            ':end_time' => $endTime,
        ]);
        return (int) $pdo->lastInsertId();
    });

    json_response(['tripId' => $tripId], 201);
}

require_csrf();
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

    audited_write(static function (PDO $pdo) use ($tripId, $endTime): void {
        $trip = require_trip_owner($pdo, $tripId);

        if ($endTime <= (string) $trip['start_time']) {
            api_error('endTime must be later than the trip start.', 422, 'invalid_argument');
        }

        $statement = $pdo->prepare(
            'UPDATE trips SET end_time = :end_time WHERE id = :trip_id AND user_id = :user_id'
        );
        $statement->execute([
            ':end_time' => $endTime,
            ':trip_id' => $tripId,
            ':user_id' => authenticated_user_id(),
        ]);
    });

    json_response(['tripId' => $tripId]);
}

if ($action === 'reset') {
    $startTime = normalize_datetime(require_string($input, 'startTime'), 'startTime');
    $endTime = normalize_datetime(require_string($input, 'endTime'), 'endTime');

    if ($endTime <= $startTime) {
        api_error('endTime must be later than startTime.', 422, 'invalid_argument');
    }

    audited_write(static function (PDO $pdo) use ($tripId, $startTime, $endTime): void {
        require_trip_owner($pdo, $tripId);

        $deleteAttributes = $pdo->prepare(
            'DELETE a FROM attributes a INNER JOIN intervals i ON i.id = a.interval_id WHERE i.trip_id = :trip_id'
        );
        $deleteAttributes->execute([':trip_id' => $tripId]);

        $deleteIntervals = $pdo->prepare('DELETE FROM intervals WHERE trip_id = :trip_id');
        $deleteIntervals->execute([':trip_id' => $tripId]);

        $updateTrip = $pdo->prepare(
            'UPDATE trips SET start_time = :start_time, end_time = :end_time WHERE id = :trip_id AND user_id = :user_id'
        );
        $updateTrip->execute([
            ':start_time' => $startTime,
            ':end_time' => $endTime,
            ':trip_id' => $tripId,
            ':user_id' => authenticated_user_id(),
        ]);
    });

    json_response(['tripId' => $tripId]);
}

api_error('Unknown trip action.', 422, 'invalid_action');
