<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_core/bootstrap.php';
require_once dirname(__DIR__) . '/_core/calendar.php';
require_once dirname(__DIR__) . '/_core/calendar_search.php';

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
    $at = $input['at'] ?? gmdate('Y-m-d\TH:i:s\Z');
    $timezone = $definition['timezone'] ?? $input['timezone'] ?? null;
    if (!is_string($timezone) || !is_string($at)) throw new InvalidArgumentException('timezone and at must be strings.');
    // Validate timezone and timestamp before making a billable search request.
    $probe = calendar_range($definition['rules'], 'day', $at, $timezone);
    $year = (int) substr($probe['startLocal'], 0, 4);
    $directory = calendar_cache_directory($config);
    $record = calendar_cached_record($directory, $profile);
    if ($record && (($record['definitionHash'] ?? null) !== hash('sha256', json_encode($definition, JSON_THROW_ON_ERROR)))) {
        $record = null;
    }
    $warning = null;
    $refreshNeeded = calendar_needs_refresh($record, $year, time());
    $searchConfigured = !empty($config['openai_api_key']) || getenv('OPENAI_API_KEY');
    if ($method === 'POST' || ($refreshNeeded && $searchConfigured && ($config['calendar_auto_refresh'] ?? false))) {
        set_time_limit(110);
        // Release the session lock during potentially slow external searches.
        session_write_close();
        try {
            $record = calendar_refresh($directory, $profile, $definition, $year,
                static fn(array $definition, int $year): array => calendar_discover($definition, $year, $config),
                $method === 'POST');
            $refreshNeeded = false;
        } catch (Throwable $error) {
            error_log('Calendar refresh: ' . $error->getMessage());
            if ($method === 'POST') api_error($error->getMessage(), 503, 'calendar_refresh_unavailable');
            $warning = 'Calendar search is unavailable; the previous validated rules are being used.';
        }
    }
    $rules = calendar_validate_rules($record['rules'] ?? $definition['rules']);
    $range = $input['range'] ?? 'week';
    if (!is_string($range)) throw new InvalidArgumentException('range must be a string.');
    try { $window = calendar_range($rules, $range, $at, $timezone); }
    catch (InvalidArgumentException $error) {
        if ($range === 'pay-period' || !$record) throw $error;
        // Independently configured recurring week rules survive a missing future payroll calendar.
        $rules = calendar_validate_rules($definition['rules']);
        $window = calendar_range($rules, $range, $at, $timezone);
        $record = null;
        $warning = 'Using the configured calendar rule; the searched calendar does not cover this range.';
    }
    json_response([
        ...$window, 'profile' => $profile, 'rules' => $rules, 'fallbackRules' => $definition['rules'],
        'sources' => $record['sources'] ?? [], 'verifiedAt' => $record['verifiedAt'] ?? null,
        'searchedYear' => $record['searchedYear'] ?? null, 'refreshNeeded' => $refreshNeeded,
        'provenance' => $record['provenance'] ?? 'configured', 'warning' => $warning,
    ]);
} catch (InvalidArgumentException $error) {
    api_error($error->getMessage(), 422, 'calendar_unavailable');
} catch (Throwable $error) {
    error_log('Calendar service: ' . $error->getMessage());
    api_error('The calendar service is unavailable.', 503, 'calendar_unavailable');
}
