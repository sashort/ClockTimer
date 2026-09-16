from pathlib import Path


def one(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


def many(text, old, new, count, label):
    found = text.count(old)
    if found != count:
        raise RuntimeError(f"{label}: expected {count} matches, found {found}")
    return text.replace(old, new)


# ClockTimer compact aggregate model.
p = Path("ClockTimer.js")
s = p.read_text()
s = one(s,
'''        #emptyTripAggregateSummary() {
            return {
                tripCount: 0,
                standardTimeMilliseconds: 0,
                actualTimeMilliseconds: 0
            };
        }''',
'''        #emptyTripAggregateSummary() {
            return {
                tripCount: 0,
                standardTimeMilliseconds: 0,
                actualTimeMilliseconds: 0,
                countedTimeMilliseconds: 0
            };
        }''', "empty aggregate")

s = one(s,
'''            const actualTimeMilliseconds =
                Number(
                    value?.actualTimeMilliseconds
                );

            if (
                !Number.isInteger(tripCount) ||
                tripCount < 0 ||
                !Number.isFinite(standardTimeMilliseconds) ||
                standardTimeMilliseconds < 0 ||
                !Number.isFinite(actualTimeMilliseconds) ||
                actualTimeMilliseconds < 0
            ) {''',
'''            const actualTimeMilliseconds =
                Number(
                    value?.actualTimeMilliseconds
                );

            const countedTimeMilliseconds =
                Number(
                    value?.countedTimeMilliseconds ?? 0
                );

            if (
                !Number.isInteger(tripCount) ||
                tripCount < 0 ||
                !Number.isFinite(standardTimeMilliseconds) ||
                standardTimeMilliseconds < 0 ||
                !Number.isFinite(actualTimeMilliseconds) ||
                actualTimeMilliseconds < 0 ||
                !Number.isFinite(countedTimeMilliseconds) ||
                countedTimeMilliseconds < 0
            ) {''', "aggregate validation")

s = one(s,
'''            return {
                tripCount,
                standardTimeMilliseconds,
                actualTimeMilliseconds
            };
        }

        #addTripAggregateSummary(''',
'''            return {
                tripCount,
                standardTimeMilliseconds,
                actualTimeMilliseconds,
                countedTimeMilliseconds
            };
        }

        #addTripAggregateSummary(''', "aggregate return")

s = one(s,
'''            target.actualTimeMilliseconds +=
                source.actualTimeMilliseconds;

            return target;''',
'''            target.actualTimeMilliseconds +=
                source.actualTimeMilliseconds;

            target.countedTimeMilliseconds +=
                source.countedTimeMilliseconds ?? 0;

            return target;''', "aggregate addition")

s = one(s,
'''                        const actualTimeMilliseconds =
                            Number(
                                trip?.actualTimeMilliseconds
                            );

                        if (
                            !Number.isFinite(standardTimeMilliseconds) ||
                            standardTimeMilliseconds < 0 ||
                            !Number.isFinite(actualTimeMilliseconds) ||
                            actualTimeMilliseconds <= 0
                        ) {''',
'''                        const actualTimeMilliseconds =
                            Number(
                                trip?.actualTimeMilliseconds
                            );

                        const countedTimeMilliseconds =
                            Number(
                                trip?.countedTimeMilliseconds ?? 0
                            );

                        if (
                            !Number.isFinite(standardTimeMilliseconds) ||
                            standardTimeMilliseconds < 0 ||
                            !Number.isFinite(actualTimeMilliseconds) ||
                            actualTimeMilliseconds <= 0 ||
                            !Number.isFinite(countedTimeMilliseconds) ||
                            countedTimeMilliseconds < 0
                        ) {''', "nonproduction validation")

s = one(s,
'''                        return {
                            standardTimeMilliseconds,
                            actualTimeMilliseconds
                        };''',
'''                        return {
                            standardTimeMilliseconds,
                            actualTimeMilliseconds,
                            countedTimeMilliseconds
                        };''', "nonproduction return")

s = one(s,
'''                const summary = {
                    tripCount: 1,
                    standardTimeMilliseconds:
                        trip.standardTimeMilliseconds,
                    actualTimeMilliseconds:
                        trip.actualTimeMilliseconds
                };''',
'''                const summary = {
                    tripCount: 1,
                    standardTimeMilliseconds:
                        trip.standardTimeMilliseconds,
                    actualTimeMilliseconds:
                        trip.actualTimeMilliseconds,
                    countedTimeMilliseconds:
                        trip.countedTimeMilliseconds
                };''', "nonproduction summary")

s = one(s,
'''                Number.isFinite(
                    totals.actualTimeMilliseconds
                ) &&
                totals.actualTimeMilliseconds >= 0
            );''',
'''                Number.isFinite(
                    totals.actualTimeMilliseconds
                ) &&
                totals.actualTimeMilliseconds >= 0 &&
                Number.isFinite(
                    totals.countedTimeMilliseconds
                ) &&
                totals.countedTimeMilliseconds >= 0
            );''', "aggregate usability")

s = one(s,
'''        #addCompletedTripToCachedTotals({
            startTime,
            standardTimeMilliseconds,
            actualTimeMilliseconds,
            nonProduction
        }) {''',
'''        #addCompletedTripToCachedTotals({
            startTime,
            standardTimeMilliseconds,
            actualTimeMilliseconds,
            countedTimeMilliseconds,
            nonProduction
        }) {''', "cached signature")

s = one(s,
'''                !Number.isFinite(actualTimeMilliseconds) ||
                actualTimeMilliseconds <= 0
            ) {''',
'''                !Number.isFinite(actualTimeMilliseconds) ||
                actualTimeMilliseconds <= 0 ||
                !Number.isFinite(countedTimeMilliseconds) ||
                countedTimeMilliseconds < 0
            ) {''', "cached validation")

s = one(s,
'''                nonProductionTrips.push({
                    standardTimeMilliseconds,
                    actualTimeMilliseconds
                });''',
'''                nonProductionTrips.push({
                    standardTimeMilliseconds,
                    actualTimeMilliseconds,
                    countedTimeMilliseconds
                });''', "cached nonproduction")

s = one(s,
'''                    {
                        tripCount: 1,
                        standardTimeMilliseconds,
                        actualTimeMilliseconds
                    }
                );''',
'''                    {
                        tripCount: 1,
                        standardTimeMilliseconds,
                        actualTimeMilliseconds,
                        countedTimeMilliseconds
                    }
                );''', "cached production")
p.write_text(s)


# Compact/non-verbose API includes counted time and persists it.
p = Path("api/trips/index.php")
s = p.read_text()
s = one(s,
"        . 'COALESCE(SUM(t.standard_time_ms), 0) AS standard_time_ms, '\n        . 'COALESCE(SUM(TIMESTAMPDIFF(MICROSECOND, t.start_time, t.end_time)), 0) AS actual_time_us '\n",
"        . 'COALESCE(SUM(t.standard_time_ms), 0) AS standard_time_ms, '\n        . 'COALESCE(SUM(t.counted_time_ms), 0) AS counted_time_ms, '\n        . 'COALESCE(SUM(TIMESTAMPDIFF(MICROSECOND, t.start_time, t.end_time)), 0) AS actual_time_us '\n", "totals SQL")
s = one(s,
"        'SELECT t.standard_time_ms, t.non_production, '\n        . 'TIMESTAMPDIFF(MICROSECOND, t.start_time, t.end_time) AS actual_time_us '\n",
"        'SELECT t.standard_time_ms, t.counted_time_ms, t.non_production, '\n        . 'TIMESTAMPDIFF(MICROSECOND, t.start_time, t.end_time) AS actual_time_us '\n", "breakdown SQL")
s = one(s,
"        'actualTimeMilliseconds' => 0,\n    ];\n\n    $addAggregate = static function (array &$aggregate, int $standard, int $actual): void {\n        $aggregate['tripCount']++;\n        $aggregate['standardTimeMilliseconds'] += $standard;\n        $aggregate['actualTimeMilliseconds'] += $actual;\n    };",
"        'actualTimeMilliseconds' => 0,\n        'countedTimeMilliseconds' => 0,\n    ];\n\n    $addAggregate = static function (array &$aggregate, int $standard, int $actual, int $counted): void {\n        $aggregate['tripCount']++;\n        $aggregate['standardTimeMilliseconds'] += $standard;\n        $aggregate['actualTimeMilliseconds'] += $actual;\n        $aggregate['countedTimeMilliseconds'] += $counted;\n    };", "aggregate helper")
s = one(s,
"        $tripActualMilliseconds =\n            intdiv($tripActualMicroseconds, 1000);\n\n        if ($tripActualMilliseconds <= 0) {",
"        $tripActualMilliseconds =\n            intdiv($tripActualMicroseconds, 1000);\n        $tripCountedMilliseconds =\n            (int) ($breakdownRow['counted_time_ms'] ?? 0);\n\n        if ($tripActualMilliseconds <= 0) {", "breakdown counted value")
s = one(s,
"                'actualTimeMilliseconds' => $tripActualMilliseconds,\n            ];",
"                'actualTimeMilliseconds' => $tripActualMilliseconds,\n                'countedTimeMilliseconds' => $tripCountedMilliseconds,\n            ];", "nonproduction counted")
s = s.replace("$standardMilliseconds,\n                $tripActualMilliseconds\n            );", "$standardMilliseconds,\n                $tripActualMilliseconds,\n                $tripCountedMilliseconds\n            );")
s = s.replace("$standardMilliseconds,\n            $tripActualMilliseconds\n        );", "$standardMilliseconds,\n            $tripActualMilliseconds,\n            $tripCountedMilliseconds\n        );")
s = one(s,
"        'actualTimeMilliseconds' => intdiv($actualMicroseconds, 1000),\n        'nonProductionFilter' => $nonProductionFilter,",
"        'actualTimeMilliseconds' => intdiv($actualMicroseconds, 1000),\n        'countedTimeMilliseconds' => (int) ($row['counted_time_ms'] ?? 0),\n        'nonProductionFilter' => $nonProductionFilter,", "top counted total")
s = one(s, "            . 't.standard_time_ms, t.non_production, t.created_at, '\n", "            . 't.standard_time_ms, t.counted_time_ms, t.non_production, t.created_at, '\n", "list SQL")
s = one(s,
"                'actualTimeMilliseconds' => intdiv($actualMicroseconds, 1000),\n                'nonProduction' => ((int) $row['non_production']) === 1,",
"                'actualTimeMilliseconds' => intdiv($actualMicroseconds, 1000),\n                'countedTimeMilliseconds' => (int) ($row['counted_time_ms'] ?? 0),\n                'nonProduction' => ((int) $row['non_production']) === 1,", "list output")
s = one(s, "$normalizeClientToken = static function (mixed $value): ?string {",
'''$requireNonNegativeMilliseconds = static function (array $source, string $name): int {
    if (!array_key_exists($name, $source)) return 0;
    $value = $source[$name];
    if (is_int($value) && $value >= 0) return $value;
    if (is_string($value) && preg_match('/^\\d+$/', $value)) return (int) $value;
    api_error($name . ' must be a non-negative integer.', 422, 'invalid_argument');
};

$normalizeClientToken = static function (mixed $value): ?string {''', "counted parser")
s = many(s, "(user_id, start_time, end_time, standard_time_ms, non_production, pending, client_token)", "(user_id, start_time, end_time, standard_time_ms, counted_time_ms, non_production, pending, client_token)", 2, "insert columns")
s = one(s, "VALUES (:user_id, :start_time, :end_time, 1, 0, 1, :client_token)", "VALUES (:user_id, :start_time, :end_time, 1, 0, 0, 1, :client_token)", "prepare value")
s = one(s, "$standardTimeMilliseconds = require_positive_int($input, 'standardTimeMilliseconds');\n\n    $nonProduction = $input['nonProduction'] ?? false;", "$standardTimeMilliseconds = require_positive_int($input, 'standardTimeMilliseconds');\n    $countedTimeMilliseconds = $requireNonNegativeMilliseconds($input, 'countedTimeMilliseconds');\n\n    $nonProduction = $input['nonProduction'] ?? false;", "post input")
s = one(s, "static function (PDO $pdo) use ($startTime, $endTime, $standardTimeMilliseconds, $nonProductionValue, $clientToken): int {", "static function (PDO $pdo) use ($startTime, $endTime, $standardTimeMilliseconds, $countedTimeMilliseconds, $nonProductionValue, $clientToken): int {", "post closure")
s = one(s, ". 'standard_time_ms = :standard_time_ms, non_production = :non_production, pending = 0 '", ". 'standard_time_ms = :standard_time_ms, counted_time_ms = :counted_time_ms, non_production = :non_production, pending = 0 '", "post update")
s = one(s, "                        ':standard_time_ms' => $standardTimeMilliseconds,\n                        ':non_production' => $nonProductionValue,", "                        ':standard_time_ms' => $standardTimeMilliseconds,\n                        ':counted_time_ms' => $countedTimeMilliseconds,\n                        ':non_production' => $nonProductionValue,", "post update args")
s = one(s, "VALUES (:user_id, :start_time, :end_time, :standard_time_ms, :non_production, 0, :client_token)", "VALUES (:user_id, :start_time, :end_time, :standard_time_ms, :counted_time_ms, :non_production, 0, :client_token)", "post insert")
s = one(s, "                ':standard_time_ms' => $standardTimeMilliseconds,\n                ':non_production' => $nonProductionValue,", "                ':standard_time_ms' => $standardTimeMilliseconds,\n                ':counted_time_ms' => $countedTimeMilliseconds,\n                ':non_production' => $nonProductionValue,", "post insert args")
s = one(s, "$standardTimeMilliseconds = require_positive_int($input, 'standardTimeMilliseconds');\n    $nonProduction = $input['nonProduction'] ?? false;", "$standardTimeMilliseconds = require_positive_int($input, 'standardTimeMilliseconds');\n    $countedTimeMilliseconds = $requireNonNegativeMilliseconds($input, 'countedTimeMilliseconds');\n    $nonProduction = $input['nonProduction'] ?? false;", "start input")
s = one(s, "static function (PDO $pdo) use ($tripId, $startTime, $endTime, $standardTimeMilliseconds, $nonProductionValue): void {", "static function (PDO $pdo) use ($tripId, $startTime, $endTime, $standardTimeMilliseconds, $countedTimeMilliseconds, $nonProductionValue): void {", "start closure")
s = one(s, ". 'standard_time_ms = :standard_time_ms, non_production = :non_production, pending = 0 '", ". 'standard_time_ms = :standard_time_ms, counted_time_ms = :counted_time_ms, non_production = :non_production, pending = 0 '", "start update")
s = one(s, "                ':standard_time_ms' => $standardTimeMilliseconds,\n                ':non_production' => $nonProductionValue,\n                ':trip_id' => $tripId,", "                ':standard_time_ms' => $standardTimeMilliseconds,\n                ':counted_time_ms' => $countedTimeMilliseconds,\n                ':non_production' => $nonProductionValue,\n                ':trip_id' => $tripId,", "start args")
s = one(s, "$standardTimeMilliseconds = require_positive_int($input, 'standardTimeMilliseconds');\n\n    audited_write(\n        static function (PDO $pdo) use ($tripId, $endTime, $standardTimeMilliseconds): void {", "$standardTimeMilliseconds = require_positive_int($input, 'standardTimeMilliseconds');\n    $countedTimeMilliseconds = $requireNonNegativeMilliseconds($input, 'countedTimeMilliseconds');\n\n    audited_write(\n        static function (PDO $pdo) use ($tripId, $endTime, $standardTimeMilliseconds, $countedTimeMilliseconds): void {", "stop input")
s = one(s, "'UPDATE trips SET end_time = :end_time, standard_time_ms = :standard_time_ms '", "'UPDATE trips SET end_time = :end_time, standard_time_ms = :standard_time_ms, counted_time_ms = :counted_time_ms '", "stop update")
s = one(s, "                ':standard_time_ms' => $standardTimeMilliseconds,\n                ':trip_id' => $tripId,", "                ':standard_time_ms' => $standardTimeMilliseconds,\n                ':counted_time_ms' => $countedTimeMilliseconds,\n                ':trip_id' => $tripId,", "stop args")
p.write_text(s)


# Database has not shipped yet, so fold the field into generation directly.
p = Path("database/create_database.sql")
s = p.read_text()
s = one(s, "    `standard_time_ms` BIGINT UNSIGNED NOT NULL,\n    `non_production` TINYINT(1) NOT NULL DEFAULT 0,", "    `standard_time_ms` BIGINT UNSIGNED NOT NULL,\n    `counted_time_ms` BIGINT UNSIGNED NOT NULL DEFAULT 0,\n    `non_production` TINYINT(1) NOT NULL DEFAULT 0,", "db counted column")
s = many(s, "             'standard_time_ms', NEW.`standard_time_ms`,\n             'non_production', NEW.`non_production`,", "             'standard_time_ms', NEW.`standard_time_ms`,\n             'counted_time_ms', NEW.`counted_time_ms`,\n             'non_production', NEW.`non_production`,", 2, "db NEW audit")
s = many(s, "             'standard_time_ms', OLD.`standard_time_ms`,\n             'non_production', OLD.`non_production`,", "             'standard_time_ms', OLD.`standard_time_ms`,\n             'counted_time_ms', OLD.`counted_time_ms`,\n             'non_production', OLD.`non_production`,", 2, "db OLD audit")
p.write_text(s)

print("counted aggregate/API/database patch complete")
