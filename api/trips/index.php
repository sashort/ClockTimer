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
        . 'AND t.pending = 0 '
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

    $aggregateBaseWhere = $where;
    $aggregateBaseParameters = $parameters;

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
            . 'AND pending = 0 '
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
            . 't.standard_time_ms, t.counted_time_ms, t.non_production, t.created_at, '
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
                'countedTimeMilliseconds' => (int) ($row['counted_time_ms'] ?? 0),
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

            foreach ($trips as &$trip) {
                foreach ($trip['intervals'] as &$interval) {
                    $attributes = $interval['attributes'] ?? [];
                    $actualEnd = $attributes['clock-timer-actual-end'] ?? null;
                    $earlyStartEnd = $attributes['clock-timer-early-start-end'] ?? null;

                    if (!is_string($actualEnd) || !is_string($earlyStartEnd)) {
                        continue;
                    }

                    try {
                        $actual = new DateTimeImmutable($actualEnd);
                        $derivedEnd = new DateTimeImmutable($earlyStartEnd);
                    }
                    catch (Throwable) {
                        continue;
                    }

                    if ($derivedEnd <= $actual) {
                        continue;
                    }

                    $interval['derivedRanges'] = [[
                        'type' => 'earlystart',
                        'startTime' => $actualEnd,
                        'endTime' => $earlyStartEnd,
                    ]];
                }
                unset($interval);
            }
            unset($trip);
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
        . 'COALESCE(SUM(t.counted_time_ms), 0) AS counted_time_ms, '
        . 'COALESCE(SUM(TIMESTAMPDIFF(MICROSECOND, t.start_time, t.end_time)), 0) AS actual_time_us '
        . 'FROM trips t WHERE ' . $where
    );
    $statement->execute($parameters);
    $row = $statement->fetch();

    $actualMicroseconds = (int) ($row['actual_time_us'] ?? 0);

    $breakdownStatement = db()->prepare(
        'SELECT t.standard_time_ms, t.counted_time_ms, t.non_production, '
        . 'TIMESTAMPDIFF(MICROSECOND, t.start_time, t.end_time) AS actual_time_us '
        . 'FROM trips t WHERE ' . $aggregateBaseWhere . ' '
        . 'ORDER BY t.start_time ASC, t.id ASC'
    );
    $breakdownStatement->execute($aggregateBaseParameters);

    $emptyAggregate = static fn (): array => [
        'tripCount' => 0,
        'standardTimeMilliseconds' => 0,
        'actualTimeMilliseconds' => 0,
        'countedTimeMilliseconds' => 0,
    ];

    $addAggregate = static function (array &$aggregate, int $standard, int $actual, int $counted): void {
        $aggregate['tripCount']++;
        $aggregate['standardTimeMilliseconds'] += $standard;
        $aggregate['actualTimeMilliseconds'] += $actual;
        $aggregate['countedTimeMilliseconds'] += $counted;
    };

    $productionAggregate = $emptyAggregate();
    $nonProductionTrips = [];

    while ($breakdownRow = $breakdownStatement->fetch()) {
        $standardMilliseconds =
            (int) ($breakdownRow['standard_time_ms'] ?? 0);
        $tripActualMicroseconds =
            (int) ($breakdownRow['actual_time_us'] ?? 0);
        $tripActualMilliseconds =
            intdiv($tripActualMicroseconds, 1000);
        $tripCountedMilliseconds =
            (int) ($breakdownRow['counted_time_ms'] ?? 0);

        if ($tripActualMilliseconds <= 0) {
            continue;
        }

        if (((int) ($breakdownRow['non_production'] ?? 0)) === 1) {
            $nonProductionTrips[] = [
                'standardTimeMilliseconds' => $standardMilliseconds,
                'actualTimeMilliseconds' => $tripActualMilliseconds,
                'countedTimeMilliseconds' => $tripCountedMilliseconds,
            ];
        }
        else {
            $addAggregate(
                $productionAggregate,
                $standardMilliseconds,
                $tripActualMilliseconds,
                $tripCountedMilliseconds
            );
        }
    }

    $allNonProductionAggregate = $emptyAggregate();
    $helpfulAggregate = $emptyAggregate();
    $nonHelpfulAggregate = $emptyAggregate();
    $productiveAggregate = $emptyAggregate();

    $productionRatio = null;
    if (
        $productionAggregate['tripCount'] > 0 &&
        $productionAggregate['standardTimeMilliseconds'] > 0 &&
        $productionAggregate['actualTimeMilliseconds'] > 0
    ) {
        $productionRatio =
            $productionAggregate['standardTimeMilliseconds'] /
            $productionAggregate['actualTimeMilliseconds'];
    }

    foreach ($nonProductionTrips as $trip) {
        $standardMilliseconds =
            $trip['standardTimeMilliseconds'];
        $tripActualMilliseconds =
            $trip['actualTimeMilliseconds'];
        $tripCountedMilliseconds =
            $trip['countedTimeMilliseconds'];

        $addAggregate(
            $allNonProductionAggregate,
            $standardMilliseconds,
            $tripActualMilliseconds,
            $tripCountedMilliseconds
        );

        $tripRatio =
            $standardMilliseconds /
            $tripActualMilliseconds;

        if (
            $productionRatio !== null &&
            $tripRatio > $productionRatio
        ) {
            $addAggregate(
                $helpfulAggregate,
                $standardMilliseconds,
                $tripActualMilliseconds,
                $tripCountedMilliseconds
            );
        }
        else {
            $addAggregate(
                $nonHelpfulAggregate,
                $standardMilliseconds,
                $tripActualMilliseconds,
                $tripCountedMilliseconds
            );
        }

        if ($tripRatio >= 1.0) {
            $addAggregate(
                $productiveAggregate,
                $standardMilliseconds,
                $tripActualMilliseconds,
                $tripCountedMilliseconds
            );
        }
    }

    json_response([
        'tripCount' => (int) ($row['trip_count'] ?? 0),
        'standardTimeMilliseconds' => (int) ($row['standard_time_ms'] ?? 0),
        'actualTimeMilliseconds' => intdiv($actualMicroseconds, 1000),
        'countedTimeMilliseconds' => (int) ($row['counted_time_ms'] ?? 0),
        'nonProductionFilter' => $nonProductionFilter,
        'aggregateBreakdown' => [
            'production' => $productionAggregate,
            'nonProduction' => [
                'all' => $allNonProductionAggregate,
                'helpful' => $helpfulAggregate,
                'nonHelpful' => $nonHelpfulAggregate,
                'productive' => $productiveAggregate,
                'trips' => $nonProductionTrips,
            ],
        ],
    ]);
}

$input = json_input();
require_csrf();

$requireNonNegativeMilliseconds = static function (array $source, string $name): int {
    if (!array_key_exists($name, $source)) return 0;
    $value = $source[$name];
    if (is_int($value) && $value >= 0) return $value;
    if (is_string($value) && preg_match('/^\d+$/', $value)) return (int) $value;
    api_error($name . ' must be a non-negative integer.', 422, 'invalid_argument');
};

$normalizeClientToken = static function (mixed $value): ?string {
    if ($value === null || $value === '') {
        return null;
    }
    if (!is_string($value)) {
        api_error('clientToken must be a UUID string.', 422, 'invalid_argument');
    }
    $token = strtolower(trim($value));
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $token)) {
        api_error('clientToken must be a UUID string.', 422, 'invalid_argument');
    }
    return $token;
};

$ensureTripIdReclaimTable = static function (): void {
    db()->exec(
        'CREATE TABLE IF NOT EXISTS reclaimed_trip_ids ('
        . 'id BIGINT UNSIGNED NOT NULL, '
        . 'reclaimed_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), '
        . 'PRIMARY KEY (id)'
        . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
};

if ($method === 'POST') {
    $clientToken = $normalizeClientToken($input['clientToken'] ?? null);
    $action = isset($input['action']) && is_string($input['action'])
        ? strtolower(trim($input['action']))
        : null;

    if ($action === 'prepare') {
        $ensureTripIdReclaimTable();

        if ($clientToken === null) {
            api_error('clientToken is required when preparing a trip.', 422, 'invalid_argument');
        }
        $startTime = isset($input['startTime'])
            ? normalize_datetime(require_string($input, 'startTime'), 'startTime')
            : (new DateTimeImmutable('now'))->format('Y-m-d H:i:s.v');
        $endTime = (new DateTimeImmutable($startTime))
            ->modify('+1 millisecond')
            ->format('Y-m-d H:i:s.v');

        $tripId = audited_write(
            static function (PDO $pdo) use ($startTime, $endTime, $clientToken): int {
                $existing = $pdo->prepare(
                    'SELECT id FROM trips WHERE user_id = :user_id AND client_token = :client_token LIMIT 1'
                );
                $existing->execute([
                    ':user_id' => authenticated_user_id(),
                    ':client_token' => $clientToken,
                ]);
                $existingId = (int) ($existing->fetchColumn() ?: 0);
                if ($existingId > 0) {
                    return $existingId;
                }

                $reclaimed = $pdo->query(
                    'SELECT id FROM reclaimed_trip_ids ORDER BY id ASC LIMIT 1 FOR UPDATE'
                );
                $reclaimedId = (int) ($reclaimed->fetchColumn() ?: 0);

                if ($reclaimedId > 0) {
                    $deleteReclaimed = $pdo->prepare(
                        'DELETE FROM reclaimed_trip_ids WHERE id = :id'
                    );
                    $deleteReclaimed->execute([
                        ':id' => $reclaimedId,
                    ]);

                    $statement = $pdo->prepare(
                        'INSERT INTO trips '
                        . '(id, user_id, start_time, end_time, standard_time_ms, counted_time_ms, non_production, pending, client_token) '
                        . 'VALUES (:id, :user_id, :start_time, :end_time, 1, 0, 0, 1, :client_token)'
                    );
                    $statement->execute([
                        ':id' => $reclaimedId,
                        ':user_id' => authenticated_user_id(),
                        ':start_time' => $startTime,
                        ':end_time' => $endTime,
                        ':client_token' => $clientToken,
                    ]);

                    return $reclaimedId;
                }

                $statement = $pdo->prepare(
                    'INSERT INTO trips '
                    . '(user_id, start_time, end_time, standard_time_ms, counted_time_ms, non_production, pending, client_token) '
                    . 'VALUES (:user_id, :start_time, :end_time, 1, 0, 0, 1, :client_token)'
                );
                $statement->execute([
                    ':user_id' => authenticated_user_id(),
                    ':start_time' => $startTime,
                    ':end_time' => $endTime,
                    ':client_token' => $clientToken,
                ]);
                return (int) $pdo->lastInsertId();
            }
        );

        json_response(['tripId' => $tripId, 'pending' => true], 201);
    }

    $startTime = normalize_datetime(require_string($input, 'startTime'), 'startTime');
    $endTime = normalize_datetime(require_string($input, 'endTime'), 'endTime');
    $standardTimeMilliseconds = require_positive_int($input, 'standardTimeMilliseconds');
    $countedTimeMilliseconds = $requireNonNegativeMilliseconds($input, 'countedTimeMilliseconds');

    $nonProduction = $input['nonProduction'] ?? false;
    if (!is_bool($nonProduction)) {
        api_error('nonProduction must be a boolean.', 422, 'invalid_argument');
    }
    $nonProductionValue = $nonProduction ? 1 : 0;

    if ($endTime <= $startTime) {
        api_error('endTime must be later than startTime.', 422, 'invalid_argument');
    }

    $tripId = audited_write(
        static function (PDO $pdo) use ($startTime, $endTime, $standardTimeMilliseconds, $countedTimeMilliseconds, $nonProductionValue, $clientToken): int {
            if ($clientToken !== null) {
                $existing = $pdo->prepare(
                    'SELECT id FROM trips WHERE user_id = :user_id AND client_token = :client_token LIMIT 1 FOR UPDATE'
                );
                $existing->execute([
                    ':user_id' => authenticated_user_id(),
                    ':client_token' => $clientToken,
                ]);
                $existingId = (int) ($existing->fetchColumn() ?: 0);
                if ($existingId > 0) {
                    $update = $pdo->prepare(
                        'UPDATE trips SET start_time = :start_time, end_time = :end_time, '
                        . 'standard_time_ms = :standard_time_ms, counted_time_ms = :counted_time_ms, non_production = :non_production, pending = 0 '
                        . 'WHERE id = :trip_id AND user_id = :user_id'
                    );
                    $update->execute([
                        ':start_time' => $startTime,
                        ':end_time' => $endTime,
                        ':standard_time_ms' => $standardTimeMilliseconds,
                        ':counted_time_ms' => $countedTimeMilliseconds,
                        ':non_production' => $nonProductionValue,
                        ':trip_id' => $existingId,
                        ':user_id' => authenticated_user_id(),
                    ]);
                    return $existingId;
                }
            }

            $statement = $pdo->prepare(
                'INSERT INTO trips '
                . '(user_id, start_time, end_time, standard_time_ms, counted_time_ms, non_production, pending, client_token) '
                . 'VALUES (:user_id, :start_time, :end_time, :standard_time_ms, :counted_time_ms, :non_production, 0, :client_token)'
            );
            $statement->execute([
                ':user_id' => authenticated_user_id(),
                ':start_time' => $startTime,
                ':end_time' => $endTime,
                ':standard_time_ms' => $standardTimeMilliseconds,
                ':counted_time_ms' => $countedTimeMilliseconds,
                ':non_production' => $nonProductionValue,
                ':client_token' => $clientToken,
            ]);
            return (int) $pdo->lastInsertId();
        }
    );

    json_response(['tripId' => $tripId, 'pending' => false], 201);
}

if ($method === 'DELETE' && !array_key_exists('tripId', $input)) {
    $clientToken = $normalizeClientToken($input['clientToken'] ?? null);
    if ($clientToken === null) {
        api_error('tripId or clientToken is required.', 422, 'invalid_argument');
    }

    $ensureTripIdReclaimTable();

    $reclaimedTripId = audited_write(static function (PDO $pdo) use ($clientToken): ?int {
        $find = $pdo->prepare(
            'SELECT id FROM trips '
            . 'WHERE user_id = :user_id AND client_token = :client_token AND pending = 1 '
            . 'LIMIT 1 FOR UPDATE'
        );
        $find->execute([
            ':user_id' => authenticated_user_id(),
            ':client_token' => $clientToken,
        ]);

        $tripId = (int) ($find->fetchColumn() ?: 0);
        if ($tripId < 1) {
            return null;
        }

        $statement = $pdo->prepare(
            'DELETE FROM trips WHERE id = :trip_id AND user_id = :user_id AND pending = 1'
        );
        $statement->execute([
            ':trip_id' => $tripId,
            ':user_id' => authenticated_user_id(),
        ]);

        if ($statement->rowCount() !== 1) {
            return null;
        }

        $reclaim = $pdo->prepare(
            'INSERT IGNORE INTO reclaimed_trip_ids (id) VALUES (:id)'
        );
        $reclaim->execute([
            ':id' => $tripId,
        ]);

        return $tripId;
    });

    json_response([
        'clientToken' => $clientToken,
        'reclaimedTripId' => $reclaimedTripId,
    ]);
}

$tripId = require_positive_int($input, 'tripId');

if ($method === 'DELETE') {
    $ensureTripIdReclaimTable();

    $reclaimedTripId = audited_write(static function (PDO $pdo) use ($tripId): ?int {
        $trip = require_trip_owner($pdo, $tripId);
        $pending = ((int) ($trip['pending'] ?? 0)) === 1;

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

        if (!$pending || $deleteTrip->rowCount() !== 1) {
            return null;
        }

        $reclaim = $pdo->prepare(
            'INSERT IGNORE INTO reclaimed_trip_ids (id) VALUES (:id)'
        );
        $reclaim->execute([
            ':id' => $tripId,
        ]);

        return $tripId;
    });

    json_response([
        'tripId' => $tripId,
        'reclaimedTripId' => $reclaimedTripId,
    ]);
}

$action = require_string($input, 'action');

if ($action === 'start') {
    $startTime = normalize_datetime(require_string($input, 'startTime'), 'startTime');
    $endTime = normalize_datetime(require_string($input, 'endTime'), 'endTime');
    $standardTimeMilliseconds = require_positive_int($input, 'standardTimeMilliseconds');
    $countedTimeMilliseconds = $requireNonNegativeMilliseconds($input, 'countedTimeMilliseconds');
    $nonProduction = $input['nonProduction'] ?? false;
    if (!is_bool($nonProduction)) {
        api_error('nonProduction must be a boolean.', 422, 'invalid_argument');
    }
    $nonProductionValue = $nonProduction ? 1 : 0;
    if ($endTime <= $startTime) {
        api_error('endTime must be later than startTime.', 422, 'invalid_argument');
    }

    audited_write(
        static function (PDO $pdo) use ($tripId, $startTime, $endTime, $standardTimeMilliseconds, $countedTimeMilliseconds, $nonProductionValue): void {
            require_trip_owner($pdo, $tripId);
            $statement = $pdo->prepare(
                'UPDATE trips SET start_time = :start_time, end_time = :end_time, '
                . 'standard_time_ms = :standard_time_ms, counted_time_ms = :counted_time_ms, non_production = :non_production, pending = 0 '
                . 'WHERE id = :trip_id AND user_id = :user_id'
            );
            $statement->execute([
                ':start_time' => $startTime,
                ':end_time' => $endTime,
                ':standard_time_ms' => $standardTimeMilliseconds,
                ':counted_time_ms' => $countedTimeMilliseconds,
                ':non_production' => $nonProductionValue,
                ':trip_id' => $tripId,
                ':user_id' => authenticated_user_id(),
            ]);
        }
    );

    json_response(['tripId' => $tripId, 'pending' => false]);
}

if ($action === 'stop') {
    $endTime = normalize_datetime(require_string($input, 'endTime'), 'endTime');
    $standardTimeMilliseconds = require_positive_int($input, 'standardTimeMilliseconds');
    $countedTimeMilliseconds = $requireNonNegativeMilliseconds($input, 'countedTimeMilliseconds');

    audited_write(
        static function (PDO $pdo) use ($tripId, $endTime, $standardTimeMilliseconds, $countedTimeMilliseconds): void {
            $trip = require_trip_owner($pdo, $tripId);

            if ($endTime <= (string) $trip['start_time']) {
                api_error('endTime must be later than the trip start.', 422, 'invalid_argument');
            }

            $statement = $pdo->prepare(
                'UPDATE trips SET end_time = :end_time, standard_time_ms = :standard_time_ms, counted_time_ms = :counted_time_ms '
                . 'WHERE id = :trip_id AND user_id = :user_id'
            );
            $statement->execute([
                ':end_time' => $endTime,
                ':standard_time_ms' => $standardTimeMilliseconds,
                ':counted_time_ms' => $countedTimeMilliseconds,
                ':trip_id' => $tripId,
                ':user_id' => authenticated_user_id(),
            ]);
        }
    );

    json_response(['tripId' => $tripId]);
}

api_error('Unknown trip action.', 422, 'invalid_action');
