<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/_core/bootstrap.php';
require_once dirname(__DIR__) . '/_core/command_checks.php';
require_method('POST');
require_csrf();
$input = json_input();
$endpoint = require_string($input, 'endpoint');
$method = require_string($input, 'method');
$command = $input['command'] ?? null;
if (!is_array($command)) api_error('command must be an object.', 422, 'invalid_argument');
if (!in_array($endpoint, ['trips', 'trip-events', 'trip-editor'], true)) api_error('Unsupported command endpoint.', 422, 'invalid_argument');
$pdo = db();
authenticated_user_id();
$tripId = isset($command['tripId']) ? require_positive_int($command, 'tripId') : null;
if ($tripId !== null) require_trip_owner($pdo, $tripId);
if ($endpoint === 'trip-events') {
    if ($method !== 'POST' || $tripId === null) api_error('Invalid event command.', 422, 'invalid_argument');
    require_trip_event_type_id($pdo, require_string($command, 'event'));
    json_response(check_trip_event_command(fetch_trip_events($pdo, $tripId), $command));
}
if ($endpoint === 'trip-editor') {
    require_once dirname(__DIR__) . '/_core/trip_editor.php';
    if ($method !== 'POST' || $tripId === null) api_error('Invalid editor command.', 422, 'invalid_argument');
    $events = fetch_trip_events($pdo, $tripId);
    if (!is_string($command['revision'] ?? null) || !hash_equals(trip_edit_revision($events), $command['revision'])) {
        json_response(['accepted' => false, 'reason' => 'The trip changed. Reopen the editor.']);
    }
    try {if (($command['operation'] ?? '') !== 'delete-trip') trip_edit_apply($events, $command);}
    catch (InvalidArgumentException $error) {json_response(['accepted' => false, 'reason' => $error->getMessage()]);}
}
if ($endpoint === 'trips') {
    if (!in_array($method, ['POST', 'PATCH', 'DELETE'], true)) api_error('Invalid trip method.', 422, 'invalid_argument');
    if ($method === 'PATCH' && !in_array($command['action'] ?? '', ['start', 'stop'], true)) api_error('Invalid trip action.', 422, 'invalid_argument');
    if ($method !== 'DELETE' && ($command['action'] ?? '') !== 'prepare') {
        $end = normalize_datetime(require_string($command, 'endTime'), 'endTime');
        require_positive_int($command, 'standardTimeMilliseconds');
        if (isset($command['startTime']) && $end <= normalize_datetime(require_string($command, 'startTime'), 'startTime')) {
            json_response(['accepted' => false, 'reason' => 'Trip end must follow its start.']);
        }
    }
}
json_response(['accepted' => true]);
