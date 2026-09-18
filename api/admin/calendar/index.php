<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/_core/bootstrap.php';
require_once dirname(__DIR__, 2) . '/_core/calendar.php';
require_once dirname(__DIR__, 2) . '/_core/calendar_store.php';
require_once dirname(__DIR__, 2) . '/_core/calendar_editor.php';
require_method('GET', 'POST');
if (empty($_SERVER['HTTPS']) || strtolower((string) $_SERVER['HTTPS']) === 'off') api_error('HTTPS is required.', 403, 'https_required');
$actor = require_permission(PERMISSION_SUPERUSER);
$profiles = calendar_profiles(api_config());
if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['editor'] ?? null) === '1') render_calendar_editor(csrf_token(), array_keys($profiles));
$input = $_SERVER['REQUEST_METHOD'] === 'POST' ? json_input() : $_GET;
if ($_SERVER['REQUEST_METHOD'] === 'POST') require_csrf();
try {
    $profile = $input['profile'] ?? 'walmart-us';
    if (!is_string($profile) || !isset($profiles[$profile])) throw new InvalidArgumentException('Unknown calendar profile.');
    $year = filter_var($input['year'] ?? gmdate('Y'), FILTER_VALIDATE_INT);
    if ($year === false || $year < 1970 || $year > 9999) throw new InvalidArgumentException('Enter a valid calendar year.');
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!is_array($input['rules'] ?? null) || !is_string($input['note'] ?? null)) throw new InvalidArgumentException('Rules and a correction note are required.');
        $record = calendar_manual_save(db(), $profile, $profiles[$profile], $year, $input['rules'], $input['note'], $actor['id']);
    } else {
        $record = calendar_stored_record(db(), $profile, $profiles[$profile], $year);
    }
    json_response(['profile' => $profile, 'year' => $year, 'record' => $record]);
} catch (InvalidArgumentException $error) {
    api_error($error->getMessage(), 422, 'invalid_calendar_rules');
} catch (RuntimeException $error) {
    error_log('Calendar editor: ' . $error->getMessage());
    api_error('Calendar changes are unavailable. Check the database migration or try again after the current refresh.', 503, 'calendar_edit_unavailable');
}
