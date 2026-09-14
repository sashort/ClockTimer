<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

$method = require_method('GET', 'POST', 'PATCH', 'DELETE');

if ($method === 'GET') {
    $userId = authenticated_user_id();

    $result = $_GET['result'] ?? 'totals';
    if (!is_string($result)) {
        api_error('result must be totals, list, or count.', 422, 'invalid_argument');
    }

    $result = strtolower(trim($result));
    if (!in_array($result, ['totals', 'list', 'count'], true)) {
        api_error('result must be totals, list, or count.', 422, 'invalid_argument');
    }

    $minInput = $_GET['minDateTime'] ?? $_GET['startTime'] ?? null;
    $maxInput = $_GET['maxDateTime'] ?? $_GET['endTime'] ?? null;

    if (!is_string($minInput) || !is_string($maxInput)) {
        api_error(
            'minDateTime and maxDateTime are required.',
            422,
            'invalid_argument'
        );
    }

    $minDateTime = normalize_datetime($minInput, 'minDateTime');
    $maxDateTime = normalize_datetime($maxInput, 'maxDateTime');

    if ($maxDateTime < $minDateTime) {
        api_error(
            'maxDateTime must be greater than or equal to minDateTime.',
            422,
            'invalid_argument'
        );
    }

    $excludeTripId = null;
    if (isset($_GET['excludeTripId']) && $_GET['excludeTripId'] !== '') {
        $excludeTripId = require_positive_int(
            ['excludeTripId' => $_GET['excludeTripId']],
            'excludeTripId'
        );
    }

    $verbose = false;
    if (array_key_exists('verbose', $_GET) && $_GET['verbose'] !== '') {
        $verboseInput = $_GET['verbose'];
        if (!is_string($verboseInput)) {
            api_error('verbose must be true, false, 1, or 0.', 422, 'invalid_argument');
        }

        $verboseText = strtolower(trim($verboseInput));
        if ($verboseText === 'true' || $verboseText === '1') {
            $verbose = true;
        }
        elseif ($verboseText === 'false' || $verboseText === '0') {
            $verbose = false;
        }
        else {
            api_error('verbose must be true, false, 1, or 0.', 422, 'invalid_argument');
        }
    }

    $nonProductionFilterInput = $_GET['nonProductionFilter'] ?? 'none';
    if (!is_string($nonProductionFilterInput)) {
        api_error(
            'nonProductionFilter must be all, helpful, productive, or none.',
            422,
            'invalid_argument'
        );
    }

    $nonProductionFilter = strtolower(trim($nonProductionFilterInput));
    if (!in_array($nonProductionFilter, ['all', 'helpful', 'productive', 'none'], true)) {
        api_error(
            'nonProductionFilter must be all, helpful, productive, or none.',
            422,
            'invalid_argument'
        );
    }

    $where =
        't.user_id = :user_id '
        . 'AND t.start_time >= :min_date_time '
        . 'AND t.start_time <= :max_date_time';

    $parameters = [
        ':user_id' => $userId,
        ':min_date_time' => $minDateTime,
        ':max_date_time' => $maxDateTime,
    ];

    if ($excludeTripId !== null) {
        $where .= ' AND t.id <> :exclude_trip_id';
        $parameters[':exclude_trip_id'] = $excludeTripId;
    }

    if ($nonProductionFilter === 'none') {
        $where .= ' AND t.non_production = 0';
    }
    elseif ($nonProductionFilter === 'productive') {
        $where .=
            ' AND (t.non_production = 0 OR '
            . '(t.non_production = 1 AND '
            . 't.standard_time_ms * 1000.0 >= '
            . 'TIMESTAMPDIFF(MICROSECOND, t.start_time, t.end_time)))';
    }
    elseif ($nonProductionFilter === 'helpful') {
        $productionSql =
            'SELECT COUNT(*) AS trip_count, '
            . 'COALESCE(SUM(standard_time_ms), 0) AS standard_time_ms, '
            . 'COALESCE(SUM(TIMESTAMPDIFF(MICROSECOND, start_time, end_time)), 0) AS actual_time_us '
            . 'FROM trips '
            . 'WHERE user_id = :production_user_id '
            . 'AND start_time >= :production_min_date_time '
            . 'AND start_time <= :production_max_date_time '
            . 'AND non_production = 0';

        $productionParameters = [
            ':production_user_id' => $userId,
            ':production_min_date_time' => $minDateTime,
            ':production_max_date_time' => $maxDateTime,
        ];

        if ($excludeTripId !== null) {
            $productionSql .= ' AND id <> :production_exclude_trip_id';
            $productionParameters[':production_exclude_trip_id'] = $excludeTripId;
        }

        $productionStatement = db()->prepare($productionSql);
        $productionStatement->execute($productionParameters);
        $productionRow = $productionStatement->fetch();

        $productionCount = (int) ($productionRow['trip_count'] ?? 0);
        $productionStandardMilliseconds =
            (int) ($productionRow['standard_time_ms'] ?? 0);
        $productionActualMicroseconds =
            (int) ($productionRow['actual_time_us'] ?? 0);

        if (
            $productionCount < 1 ||
            $productionStandardMilliseconds <= 0 ||
            $productionActualMicroseconds <= 0
        ) {
            $where .= ' AND t.non_production = 0';
        }
        else {
            $productionRatio =
                ($productionStandardMilliseconds * 1000.0) /
                $productionActualMicroseconds;

            $where .=
                ' AND (t.non_production = 0 OR '
                . '(t.non_production = 1 AND '
                . '(t.standard_time_ms * 1000.0 / '
                . 'TIMESTAMPDIFF(MICROSECOND, t.start_time, t.end_time)) '
                . '> :production_ratio))';

            $parameters[':production_ratio'] = $productionRatio;
        }
    }

    if ($result === 'count') {
        $statement = db()->prepare(
            'SELECT COUNT(*) AS trip_count FROM trips t WHERE ' . $where
        );
        $statement->execute($parameters);
        $row = $statement->fetch();

        json_response([
            'tripCount' => (int) ($row['trip_count'] ?? 0),
            'nonProductionFilter' => $nonProductionFilter,
        ]);
    }

    if ($result === 'list') {
        $limit = 100;
        if (isset($_GET['limit']) && $_GET['limit'] !== '') {
            $limitInput = $_GET['limit'];
            if (
                !is_string($limitInput) ||
                !preg_match('/^[1-9]\d*$/', $limitInput)
            ) {
                api_error('limit must be a positive integer.', 422, 'invalid_argument');
            }

            $limit = (int) $limitInput;
            if ($limit > 1000) {
                api_error('limit must not exceed 1000.', 422, 'invalid_argument');
            }
        }

        $offset = 0;
        if (isset($_GET['offset']) && $_GET['offset'] !== '') {
            $offsetInput = $_GET['offset'];
            if (
                !is_string($offsetInput) ||
                !preg_match('/^\d+$/', $offsetInput)
            ) {
                api_error('offset must be a non-negative integer.', 422, 'invalid_argument');
            }

            $offset = (int) $offsetInput;
        }

        $statement = db()->prepare(
            'SELECT t.id, t.user_id, t.start_time, t.end_time, '
            . 't.standard_time_ms, t.non_production, t.created_at, '
            . 'TIMESTAMPDIFF(MICROSECOND, t.start_time, t.end_time) AS actual_time_us '
            . 'FROM trips t WHERE ' . $where . ' '
            . 'ORDER BY t.start_time ASC, t.id ASC '
            . 'LIMIT ' . $limit . ' OFFSET ' . $offset
        );
        $statement->execute($parameters);

        $trips = [];
        $tripIndexes = [];

        while ($row = $statement->fetch()) {
            $actualMicroseconds = (int) ($row['actual_time_us'] ?? 0);
            $tripId = (int) $row['id'];

            $trip = [
                'id' => $tripId,
                'startTime' => (string) $row['start_time'],
                'endTime' => (string) $row['end_time'],
                'standardTimeMilliseconds' => (int) $row['standard_time_ms'],
                'actualTimeMilliseconds' => intdiv($actualMicroseconds, 1000),
                'nonProduction' => ((int) $row['non_production']) === 1,
            ];

            if ($verbose) {
                $trip['userId'] = (int) $row['user_id'];
                $trip['createdAt'] = (string) $row['created_at'];
                $trip['intervalCount'] = 0;
                $trip['intervals'] = [];
                $tripIndexes[$tripId] = count($trips);
            }

            $trips[] = $trip;
        }

        if ($verbose && $tripIndexes !== []) {
            $intervalParameters = [];
            $placeholders = [];

            foreach (array_keys($tripIndexes) as $index => $tripId) {
                $placeholder = ':trip_id_' . $index;
                $placeholders[] = $placeholder;
                $intervalParameters[$placeholder] = $tripId;
            }

            $intervalStatement = db()->prepare(
                'SELECT i.trip_id, i.id, i.type, i.start_time, i.end_time, '
                . 'a.id AS attribute_id, a.name AS attribute_name, a.value AS attribute_value '
                . 'FROM intervals i '
                . 'LEFT JOIN attributes a ON a.interval_id = i.id '
                . 'WHERE i.trip_id IN (' . implode(', ', $placeholders) . ') '
                . 'ORDER BY i.trip_id ASC, i.start_time ASC, i.id ASC, a.id ASC'
            );
            $intervalStatement->execute($intervalParameters);

            $intervalIndexes = [];

            while ($row = $intervalStatement->fetch()) {
                $tripId = (int) $row['trip_id'];
                $intervalId = (int) $row['id'];
                $tripIndex = $tripIndexes[$tripId];

                if (!isset($intervalIndexes[$tripId][$intervalId])) {
                    $intervalIndex = count($trips[$tripIndex]['intervals']);
                    $intervalIndexes[$tripId][$intervalId] = $intervalIndex;

                    $trips[$tripIndex]['intervals'][] = [
                        'id' => $intervalId,
                        'type' => (string) $row['type'],
                        'startTime' => (string) $row['start_time'],
                        'endTime' => $row['end_time'] === null
                            ? null
                            : (string) $row['end_time'],
                        'attributes' => [],
                    ];
                }

                if ($row['attribute_id'] !== null) {
                    $intervalIndex = $intervalIndexes[$tripId][$intervalId];
                    $trips[$tripIndex]['intervals'][$intervalIndex]['attributes'][
                        (string) $row['attribute_name']
                    ] = (string) $row['attribute_value'];
                }
            }

            foreach ($tripIndexes as $tripId => $tripIndex) {
                $trips[$tripIndex]['intervalCount'] = count(
                    $trips[$tripIndex]['intervals']
                );
            }
        }

        json_response([
            'trips' => $trips,
            'limit' => $limit,
            'offset' => $offset,
            'returnedCount' => count($trips),
            'verbose' => $verbose,
            'nonProductionFilter' => $nonProductionFilter,
        ]);
    }

    $statement = db()->prepare(
        'SELECT COUNT(*) AS trip_count, '
        . 'COALESCE(SUM(t.standard_time_ms), 0) AS standard_time_ms, '
        . 'COALESCE(SUM(TIMESTAMPDIFF(MICROSECOND, t.start_time, t.end_time)), 0) AS actual_time_us '
        . 'FROM trips t WHERE ' . $where
    );
    $statement->execute($parameters);
    $row = $statement->fetch();

    $actualMicroseconds = (int) ($row['actual_time_us'] ?? 0);

    json_response([
        'tripCount' => (int) ($row['trip_count'] ?? 0),
        'standardTimeMilliseconds' => (int) ($row['standard_time_ms'] ?? 0),
        'actualTimeMilliseconds' => intdiv($actualMicroseconds, 1000),
        'nonProductionFilter' => $nonProductionFilter,
    ]);
}

$input = json_input();
require_csrf();

if ($method === 'POST') {
    $startTime = normalize_datetime(require_string($input, 'startTime'), 'startTime');
    $endTime = normalize_datetime(require_string($input, 'endTime'), 'endTime');
    $standardTimeMilliseconds = require_positive_int($input, 'standardTimeMilliseconds');

    $nonProduction = $input['nonProduction'] ?? false;
    if (!is_bool($nonProduction)) {
        api_error('nonProduction must be a boolean.', 422, 'invalid_argument');
    }
    $nonProductionValue = $nonProduction ? 1 : 0;

    if ($endTime <= $startTime) {
        api_error('endTime must be later than startTime.', 422, 'invalid_argument');
    }

    $tripId = audited_write(
        static function (PDO $pdo) use ($startTime, $endTime, $standardTimeMilliseconds, $nonProductionValue): int {
            $statement = $pdo->prepare(
                'INSERT INTO trips (user_id, start_time, end_time, standard_time_ms, non_production) '
                . 'VALUES (:user_id, :start_time, :end_time, :standard_time_ms, :non_production)'
            );
            $statement->execute([
                ':user_id' => authenticated_user_id(),
                ':start_time' => $startTime,
                ':end_time' => $endTime,
                ':standard_time_ms' => $standardTimeMilliseconds,
                ':non_production' => $nonProductionValue,
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

api_error('Unknown trip action.', 422, 'invalid_action');
