<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/api/_core/calendar.php';
require_once dirname(__DIR__) . '/api/_core/calendar_search.php';

$passed = 0;
function check(string $label, callable $test): void {
    global $passed;
    $test(); $passed++; echo "PASS $label\n";
}
function same(mixed $actual, mixed $expected): void {
    if ($actual !== $expected) throw new RuntimeException(json_encode(['actual' => $actual, 'expected' => $expected]));
}
function rejects(callable $test): void {
    try { $test(); } catch (InvalidArgumentException) { return; }
    throw new RuntimeException('Expected an invalid calendar to be rejected.');
}
$rules = calendar_profiles([])['walmart-us']['rules'];
check('Friday belongs to the preceding Saturday week', function () use ($rules) {
    $result = calendar_range($rules, 'week', '2026-09-18T23:59:59-04:00', 'America/New_York');
    same($result['startTime'], '2026-09-12T04:00:00.000Z');
    same($result['endTime'], '2026-09-19T04:00:00.000Z');
});
check('exact Saturday midnight starts a new week', function () use ($rules) {
    same(calendar_range($rules, 'week', '2026-09-19T00:00:00-04:00', 'America/New_York')['startTime'], '2026-09-19T04:00:00.000Z');
});
check('2028 leap day has the correct Saturday boundary', function () use ($rules) {
    $result = calendar_range($rules, 'week', '2028-02-29T12:00:00-05:00', 'America/New_York');
    same($result['startTime'], '2028-02-26T05:00:00.000Z');
    same($result['endTime'], '2028-03-04T05:00:00.000Z');
});
check('spring DST week is 167 hours', function () use ($rules) {
    $result = calendar_range($rules, 'week', '2028-03-12T12:00:00-04:00', 'America/New_York');
    same((strtotime($result['endTime']) - strtotime($result['startTime'])) / 3600, 167);
});
check('autumn DST week is 169 hours', function () use ($rules) {
    $result = calendar_range($rules, 'week', '2028-11-05T12:00:00-05:00', 'America/New_York');
    same((strtotime($result['endTime']) - strtotime($result['startTime'])) / 3600, 169);
});
check('timezone is independent of server timezone', function () use ($rules) {
    same(calendar_range($rules, 'week', '2028-02-29T12:00:00Z', 'America/Los_Angeles')['startTime'], '2028-02-26T08:00:00.000Z');
});
$payRules = [...$rules, 'payPeriodDays' => 14, 'payPeriodAnchorDate' => '2026-01-03', 'effectiveThrough' => '2026-12-31'];
check('recurring pay cycle works two years later', function () use ($payRules) {
    $result = calendar_range($payRules, 'pay-period', '2028-02-29T12:00:00-05:00', 'America/New_York');
    same($result['startTime'], '2028-02-26T05:00:00.000Z');
    same($result['endTime'], '2028-03-11T05:00:00.000Z'); same($result['extrapolated'], true);
});
check('pay cycle calculates dates before the anchor using floor', function () use ($payRules) {
    same(calendar_range($payRules, 'pay-period', '2026-01-02T12:00:00Z', 'UTC')['startTime'], '2025-12-20T00:00:00.000Z');
});
check('missing pay anchor is never guessed', fn() => rejects(fn() => calendar_range($rules, 'pay-period', '2028-02-29T12:00:00Z', 'UTC')));
check('annual calendar cannot silently extrapolate', fn() => rejects(fn() => calendar_range([...$payRules, 'recurring' => false], 'pay-period', '2028-02-29T12:00:00Z', 'UTC')));
check('incomplete annual range is rejected', fn() => rejects(fn() => calendar_range([...$payRules, 'recurring' => false], 'pay-period', '2026-12-31T12:00:00Z', 'UTC')));
check('invalid timezone rejected', fn() => rejects(fn() => calendar_range($rules, 'week', '2028-02-29T12:00:00Z', '+04:00')));
check('ambiguous timestamp without offset rejected', fn() => rejects(fn() => calendar_range($rules, 'week', '2028-02-29T12:00:00', 'UTC')));
check('invalid date rejected', fn() => rejects(fn() => calendar_date('2028-02-30')));
check('invalid cutoff rejected', fn() => rejects(fn() => calendar_validate_rules([...$rules, 'cutoffTime' => '24:00:00'])));
check('generic Sunday week supported', function () use ($rules) {
    same(calendar_range([...$rules, 'weekStartDay' => 0], 'week', '2028-02-29T12:00:00Z', 'UTC')['startTime'], '2028-02-27T00:00:00.000Z');
});
check('generic nonmidnight workday cutoff supported', function () use ($rules) {
    same(calendar_range([...$rules, 'cutoffTime' => '04:00:00'], 'day', '2028-02-29T03:59:59Z', 'UTC')['startTime'], '2028-02-28T04:00:00.000Z');
});
check('Gregorian month and year boundaries supported', function () use ($rules) {
    same(calendar_range($rules, 'month', '2028-02-29T12:00:00Z', 'UTC')['endTime'], '2028-03-01T00:00:00.000Z');
    same(calendar_range($rules, 'year', '2028-02-29T12:00:00Z', 'UTC')['endTime'], '2029-01-01T00:00:00.000Z');
});
check('year rollover forces a new search', fn() => same(calendar_needs_refresh(['searchedYear' => 2026, 'verifiedAt' => time()], 2028, time()), true));
check('fresh same-year rules do not repeat a search', fn() => same(calendar_needs_refresh(['searchedYear' => 2028, 'verifiedAt' => time()], 2028, time()), false));
check('30-day-old verification requires refresh', fn() => same(calendar_needs_refresh(['searchedYear' => 2028, 'verifiedAt' => time() - 30 * 86400], 2028, time()), true));
check('official domain accepted and lookalikes rejected', function () {
    same(calendar_source_allowed('https://one.walmart.com/calendar.pdf', ['one.walmart.com']), true);
    foreach (['https://one.walmart.com.attacker.test/calendar', 'https://attacker.test/one.walmart.com', 'http://one.walmart.com/calendar', 'https://bob@one.walmart.com/calendar'] as $url) {
        same(calendar_source_allowed($url, ['one.walmart.com']), false);
    }
});
$definition = calendar_profiles([])['walmart-us'];
$url = 'https://one.walmart.com/calendar-2028.pdf';
$candidate = [...$payRules, 'effectiveThrough' => '2028-12-31',
    'observedPeriodStarts' => ['2028-01-01', '2028-01-15', '2028-01-29'], 'evidence' => []];
foreach (['weekStartDay', 'cutoffTime', 'payPeriodDays', 'payPeriodAnchorDate', 'recurring'] as $field) {
    $candidate['evidence'][] = ['field' => $field, 'url' => $url, 'quote' => 'Synthetic test evidence for ' . $field];
}
check('source-supported consistent recurring cycle accepted', fn() => same(calendar_validate_discovery($candidate, $definition, 2028, [$url])['rules']['payPeriodDays'], 14));
check('wrong pay-period phase rejected', fn() => rejects(fn() => calendar_validate_discovery([...$candidate, 'payPeriodAnchorDate' => '2026-01-10'], $definition, 2028, [$url])));
check('inconsistent observed periods rejected', fn() => rejects(fn() => calendar_validate_discovery([...$candidate, 'observedPeriodStarts' => ['2028-01-01', '2028-01-15', '2028-01-30']], $definition, 2028, [$url])));
check('invented source URL rejected', fn() => rejects(fn() => calendar_validate_discovery($candidate, $definition, 2028, [])));
check('calendar from wrong year rejected', fn() => rejects(fn() => calendar_validate_discovery([...$candidate, 'effectiveThrough' => '2026-12-31'], $definition, 2028, [$url])));
check('unsupported recurrence rejected', fn() => rejects(fn() => calendar_validate_discovery([...$candidate, 'evidence' => array_slice($candidate['evidence'], 0, 4)], $definition, 2028, [$url])));
check('search targets requested year and structured extraction is separate', function () use ($definition, $candidate, $url) {
    $calls = [];
    $request = function (array $payload) use (&$calls, $candidate, $url): array {
        $calls[] = $payload;
        if (count($calls) === 1) return ['output' => [
            ['type' => 'web_search_call', 'action' => ['sources' => [['url' => $url]]]],
            ['content' => [['type' => 'output_text', 'text' => 'Synthetic test calendar research']]],
        ]];
        return ['output' => [['content' => [['type' => 'output_text', 'text' => json_encode($candidate)]]]]];
    };
    $result = calendar_discover($definition, 2028, [], $request);
    same(count($calls), 2); same(str_contains($calls[0]['input'], '2028'), true);
    same($calls[0]['tools'][0]['filters']['allowed_domains'], $definition['allowedDomains']);
    same($calls[1]['text']['format']['strict'], true); same(isset($calls[1]['tools']), false);
    same($result['rules']['payPeriodDays'], 14);
});
$cacheDirectory = sys_get_temp_dir() . '/clocktimer-calendar-test-' . bin2hex(random_bytes(8));
try {
    check('successful discovery saves private reusable rules', function () use ($cacheDirectory, $definition, $candidate, $url) {
        $record = calendar_refresh($cacheDirectory, 'test-profile', $definition, 2028,
            fn() => calendar_validate_discovery($candidate, $definition, 2028, [$url]));
        same($record['searchedYear'], 2028);
        same(calendar_cached_record($cacheDirectory, 'test-profile')['rules']['payPeriodDays'], 14);
    });
    check('fresh cache does not invoke the search provider', function () use ($cacheDirectory, $definition) {
        $record = calendar_refresh($cacheDirectory, 'test-profile', $definition, 2028, fn() => throw new RuntimeException('Unexpected search'));
        same($record['searchedYear'], 2028);
    });
    check('failed future-year discovery preserves the previous rules', function () use ($cacheDirectory, $definition) {
        file_put_contents($cacheDirectory . '/test-profile.attempt', '0');
        try {
            calendar_refresh($cacheDirectory, 'test-profile', $definition, 2029, fn() => throw new RuntimeException('Simulated provider outage'));
            throw new LogicException('An outage should fail the refresh.');
        } catch (RuntimeException $error) { same($error->getMessage(), 'Simulated provider outage'); }
        same(calendar_cached_record($cacheDirectory, 'test-profile')['searchedYear'], 2028);
    });
    check('failed search retry is bounded by the hourly attempt limit', function () use ($cacheDirectory, $definition) {
        try {
            calendar_refresh($cacheDirectory, 'test-profile', $definition, 2029, fn() => throw new LogicException('Provider must not run'));
            throw new LogicException('Rate limit should reject refresh.');
        } catch (RuntimeException $error) { same(str_contains($error->getMessage(), 'once per hour'), true); }
    });
    check('cache profile paths cannot escape the directory', fn() => rejects(fn() => calendar_cached_record($cacheDirectory, '../escape')));
} finally {
    foreach (['test-profile.json', 'test-profile.lock', 'test-profile.attempt'] as $filename) {
        $path = $cacheDirectory . '/' . $filename;
        if (is_file($path)) unlink($path);
    }
    if (is_dir($cacheDirectory)) rmdir($cacheDirectory);
}
echo "$passed calendar checks passed.\n";
