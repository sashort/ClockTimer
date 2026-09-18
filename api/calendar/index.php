<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_core/bootstrap.php';
require_once dirname(__DIR__) . '/_core/calendar.php';
require_once dirname(__DIR__) . '/_core/calendar_search.php';
require_once dirname(__DIR__) . '/_core/calendar_store.php';

$method = require_method('GET', 'POST');
authenticated_user_id();
$config = api_config();
$input = $method === 'POST' ? json_input() : $_GET;
if ($method === 'POST') {
    require_csrf();
    require_permission(PERMISSION_SUPERUSER);
}
try {
    $profile = $input['profile'] ?? 'walmart-us';
    $profiles = calendar_profiles($config);
    if (!is_string($profile) || !isset($profiles[$profile])) throw new InvalidArgumentException('Unknown calendar profile.');
    $definition = $profiles[$profile];
    $range = $input['range'] ?? 'week';
    if (!is_string($range) || !in_array($range, ['day', 'week', 'pay-period', 'month', 'year'], true)) throw new InvalidArgumentException('Unknown Trip Log Range.');
    $at = $input['at'] ?? gmdate('Y-m-d\TH:i:s\Z');
    $timezone = $definition['timezone'] ?? $input['timezone'] ?? null;
    if (!is_string($timezone) || !is_string($at)) throw new InvalidArgumentException('timezone and at must be strings.');
    // Validate timezone and timestamp before making a billable search request.
    $year = (int) calendar_moment($at, $timezone)->format('Y');
    $directory = calendar_cache_directory($config);
    $record = calendar_stored_record(db(), $profile, $definition, $year);
    if ($record && (($record['definitionHash'] ?? null) !== hash('sha256', json_encode($definition, JSON_THROW_ON_ERROR)))) {
        $record = null;
    }
    $warning = null;
    $refreshNeeded = calendar_needs_refresh($record, $year, time());
    // User lookups are database-only; only explicit superuser updates discover rules.
    if ($method === 'POST' && $refreshNeeded) {
        set_time_limit(110);
        // Release the session lock during potentially slow external searches.
        session_write_close();
        try {
            $record = calendar_refresh_stored(db(), $profile, $definition, $year,
                static fn(array $definition, int $year): array => calendar_discover($definition, $year, $config),
                $method === 'POST', $directory);
            $refreshNeeded = false;
        } catch (Throwable $error) {
            error_log('Calendar refresh: ' . $error->getMessage());
            if ($method === 'POST') api_error($error->getMessage(), 503, 'calendar_refresh_unavailable');
            $warning = 'Calendar search is unavailable; the previous validated rules are being used.';
        }
    }
    if (!$record) api_error('Calendar rules have not been discovered. Configure search and refresh the calendar.', 503, 'calendar_not_discovered');
    $rules = calendar_validate_rules($record['rules']);
    $window = calendar_range($rules, $range, $at, $timezone);
    json_response([
        ...$window, 'profile' => $profile, 'rules' => $rules,
        'sources' => $record['sources'] ?? [], 'verifiedAt' => $record['verifiedAt'] ?? null,
        'searchedYear' => $record['searchedYear'] ?? null, 'refreshNeeded' => $refreshNeeded,
        'provenance' => $record['provenance'], 'warning' => $warning,
    ]);
} catch (InvalidArgumentException $error) {
    api_error($error->getMessage(), 422, 'calendar_unavailable');
} catch (Throwable $error) {
    error_log('Calendar service: ' . $error->getMessage());
    api_error('The calendar service is unavailable.', 503, 'calendar_unavailable');
}
