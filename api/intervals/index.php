<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

$method = require_method('POST', 'PATCH');
require_csrf();
$input = json_input();

if ($method === 'POST') {
    $tripId = require_positive_int($input, 'tripId');
    $type = require_string($input, 'type');
    $startTime = normalize_datetime(require_string($input, 'startTime'), 'startTime');

    $endTime = null;
    if (array_key_exists('endTime', $input) && $input['endTime'] !== null) {
        if (!is_string($input['endTime'])) {
            api_error('endTime must be a date/time string or null.', 422, 'invalid_argument');
        }
        $endTime = normalize_datetime($input['endTime'], 'endTime');
        if ($endTime <= $startTime) {
            api_error('endTime must be later than startTime.', 422, 'invalid_argument');
        }
    }

    $attributes = $input['attributes'] ?? [];
    if (!is_array($attributes)) {
        api_error('attributes must be an object.', 422, 'invalid_argument');
    }

    unset($attributes['interval-id']);

    $intervalId = audited_write(static function (PDO $pdo) use ($tripId, $type, $startTime, $endTime, $attributes): int {
        require_trip_owner($pdo, $tripId);

        $statement = $pdo->prepare(
            'INSERT INTO intervals (trip_id, type, start_time, end_time) VALUES (:trip_id, :type, :start_time, :end_time)'
        );
        $statement->execute([
            ':trip_id' => $tripId,
            ':type' => $type,
            ':start_time' => $startTime,
            ':end_time' => $endTime,
        ]);

        $intervalId = (int) $pdo->lastInsertId();

        if ($attributes !== []) {
            $attributeStatement = $pdo->prepare(
                'INSERT INTO attributes (interval_id, name, value) VALUES (:interval_id, :name, :value)'
            );

            foreach ($attributes as $name => $value) {
                $name = trim((string) $name);
                if ($name === '') {
                    api_error('Attribute names must not be empty.', 422, 'invalid_argument');
                }

                $attributeStatement->execute([
                    ':interval_id' => $intervalId,
                    ':name' => $name,
                    ':value' => is_string($value) ? $value : json_encode($value, JSON_THROW_ON_ERROR),
                ]);
            }
        }

        return $intervalId;
    });

    json_response([
        'tripId' => $tripId,
        'intervalId' => $intervalId,
    ], 201);
}

$intervalId = require_positive_int($input, 'intervalId');
$endTime = normalize_datetime(require_string($input, 'endTime'), 'endTime');

$tripId = audited_write(static function (PDO $pdo) use ($intervalId, $endTime): int {
    $interval = require_interval_owner($pdo, $intervalId);

    if ($endTime <= (string) $interval['start_time']) {
        api_error('endTime must be later than the interval start.', 422, 'invalid_argument');
    }

    $statement = $pdo->prepare('UPDATE intervals SET end_time = :end_time WHERE id = :id');
    $statement->execute([
        ':end_time' => $endTime,
        ':id' => $intervalId,
    ]);

    return (int) $interval['trip_id'];
});

json_response([
    'tripId' => $tripId,
    'intervalId' => $intervalId,
]);
