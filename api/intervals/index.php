<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

function normalize_interval_attributes(mixed $value): array
{
    if (!is_array($value)) {
        api_error('attributes must be an object.', 422, 'invalid_argument');
    }

    $attributes = [];
    $approvalState = null;

    foreach ($value as $rawName => $rawValue) {
        $name = trim((string) $rawName);
        if ($name === '') {
            api_error('Attribute names must not be empty.', 422, 'invalid_argument');
        }

        $normalizedName = strtolower($name);
        if ($normalizedName === 'interval-id') {
            continue;
        }

        if ($normalizedName === 'approved' || $normalizedName === 'unapproved') {
            if ($approvalState !== null && $approvalState !== $normalizedName) {
                api_error('An interval cannot contain both approved and unapproved attributes.', 422, 'invalid_argument');
            }

            if (!is_string($rawValue)) {
                api_error($normalizedName . ' must be a human-readable duration string.', 422, 'invalid_argument');
            }

            $duration = trim($rawValue);
            if (!preg_match('/^(?:\d+:[0-5]\d|\d+:[0-5]\d:[0-5]\d)(?:\.\d{1,3})?$/', $duration)) {
                api_error($normalizedName . ' must match [h:]m:ss[.ms].', 422, 'invalid_argument');
            }

            $approvalState = $normalizedName;
            $attributes[$normalizedName] = $duration;
            continue;
        }

        $attributes[$name] = is_string($rawValue)
            ? $rawValue
            : json_encode($rawValue, JSON_THROW_ON_ERROR);
    }

    return $attributes;
}

function replace_interval_attributes(PDO $pdo, int $intervalId, array $attributes): void
{
    $deleteStatement = $pdo->prepare('DELETE FROM attributes WHERE interval_id = :interval_id');
    $deleteStatement->execute([
        ':interval_id' => $intervalId,
    ]);

    if ($attributes === []) {
        return;
    }

    $attributeStatement = $pdo->prepare(
        'INSERT INTO attributes (interval_id, name, value) VALUES (:interval_id, :name, :value)'
    );

    foreach ($attributes as $name => $value) {
        $attributeStatement->execute([
            ':interval_id' => $intervalId,
            ':name' => $name,
            ':value' => $value,
        ]);
    }
}

$method = require_method('POST', 'PATCH', 'DELETE');
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

    $attributes = normalize_interval_attributes($input['attributes'] ?? []);

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
        replace_interval_attributes($pdo, $intervalId, $attributes);

        return $intervalId;
    });

    json_response([
        'tripId' => $tripId,
        'intervalId' => $intervalId,
    ], 201);
}

if ($method === 'DELETE') {
    $intervalId = require_positive_int($input, 'intervalId');

    $tripId = audited_write(static function (PDO $pdo) use ($intervalId): int {
        $interval = require_interval_owner($pdo, $intervalId);

        $attributeStatement = $pdo->prepare(
            'DELETE FROM attributes WHERE interval_id = :interval_id'
        );
        $attributeStatement->execute([
            ':interval_id' => $intervalId,
        ]);

        $statement = $pdo->prepare(
            'DELETE FROM intervals WHERE id = :id'
        );
        $statement->execute([
            ':id' => $intervalId,
        ]);

        return (int) $interval['trip_id'];
    });

    json_response([
        'tripId' => $tripId,
        'intervalId' => $intervalId,
        'deleted' => true,
    ]);
}

$intervalId = require_positive_int($input, 'intervalId');
$hasEndTime = array_key_exists('endTime', $input);
$hasAttributes = array_key_exists('attributes', $input);

if (!$hasEndTime && !$hasAttributes) {
    api_error('PATCH requires endTime, attributes, or both.', 422, 'invalid_argument');
}

$endTime = null;
if ($hasEndTime) {
    $endTime = normalize_datetime(require_string($input, 'endTime'), 'endTime');
}

$attributes = $hasAttributes
    ? normalize_interval_attributes($input['attributes'])
    : null;

$tripId = audited_write(static function (PDO $pdo) use (
    $intervalId,
    $hasEndTime,
    $endTime,
    $hasAttributes,
    $attributes
): int {
    $interval = require_interval_owner($pdo, $intervalId);

    if ($hasEndTime) {
        if ($endTime <= (string) $interval['start_time']) {
            api_error('endTime must be later than the interval start.', 422, 'invalid_argument');
        }

        $statement = $pdo->prepare('UPDATE intervals SET end_time = :end_time WHERE id = :id');
        $statement->execute([
            ':end_time' => $endTime,
            ':id' => $intervalId,
        ]);
    }

    if ($hasAttributes) {
        replace_interval_attributes($pdo, $intervalId, $attributes ?? []);
    }

    return (int) $interval['trip_id'];
});

json_response([
    'tripId' => $tripId,
    'intervalId' => $intervalId,
]);
