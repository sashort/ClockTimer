<?php
declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/_core/bootstrap.php';

$method = require_method('GET', 'POST');

authenticated_user_id();
require_any_permission(
    PERMISSION_DEVELOPER_PREVIEW,
    PERMISSION_DEVELOPER
);
require_csrf();

header('Cache-Control: no-store, private');

const SPEECH_EDITOR_AGENT_MAX_REQUESTS = 50;
const SPEECH_EDITOR_AGENT_TTL = 900;
const SPEECH_EDITOR_AGENT_LEASE_SECONDS = 20;
const SPEECH_EDITOR_AGENT_MAX_COMMAND_BYTES = 131072;

$now = time();

if (!isset($_SESSION['speech_editor_agent']) || !is_array($_SESSION['speech_editor_agent'])) {
    $_SESSION['speech_editor_agent'] = [
        'requests' => [],
        'manifest' => null,
        'state' => null,
        'editorInstance' => null,
        'registeredAt' => null,
    ];
}

$agent =& $_SESSION['speech_editor_agent'];

if (!isset($agent['requests']) || !is_array($agent['requests'])) {
    $agent['requests'] = [];
}

foreach ($agent['requests'] as $id => $request) {
    $createdAt = (int) ($request['createdAt'] ?? 0);

    if ($createdAt < $now - SPEECH_EDITOR_AGENT_TTL) {
        unset($agent['requests'][$id]);
        continue;
    }

    if (
        ($request['status'] ?? '') === 'running' &&
        (int) ($request['leasedAt'] ?? 0) < $now - SPEECH_EDITOR_AGENT_LEASE_SECONDS
    ) {
        $agent['requests'][$id]['status'] = 'pending';
        $agent['requests'][$id]['editorInstance'] = null;
        $agent['requests'][$id]['leasedAt'] = null;
    }
}

$publicRequest = static function (array $request): array {
    return [
        'requestId' => $request['requestId'],
        'status' => $request['status'],
        'createdAt' => $request['createdAt'],
        'startedAt' => $request['startedAt'] ?? null,
        'completedAt' => $request['completedAt'] ?? null,
        'ok' => $request['ok'] ?? null,
        'result' => $request['result'] ?? null,
        'error' => $request['error'] ?? null,
        'state' => $request['state'] ?? null,
    ];
};

$validInstance = static function (mixed $value): string {
    if (!is_string($value) || !preg_match('/^[A-Za-z0-9_-]{8,100}$/D', $value)) {
        api_error('A valid editorInstance is required.', 422, 'invalid_editor_instance');
    }

    return $value;
};

if ($method === 'GET') {
    $operation = is_string($_GET['operation'] ?? null)
        ? $_GET['operation']
        : 'status';

    if ($operation === 'manifest') {
        json_response([
            'connected' => is_array($agent['manifest'] ?? null),
            'editorInstance' => $agent['editorInstance'] ?? null,
            'registeredAt' => $agent['registeredAt'] ?? null,
            'manifest' => $agent['manifest'] ?? null,
            'state' => $agent['state'] ?? null,
        ]);
    }

    if ($operation === 'next') {
        $editorInstance = $validInstance($_GET['editorInstance'] ?? null);

        foreach ($agent['requests'] as $id => $request) {
            if (($request['status'] ?? '') !== 'pending') {
                continue;
            }

            $agent['requests'][$id]['status'] = 'running';
            $agent['requests'][$id]['editorInstance'] = $editorInstance;
            $agent['requests'][$id]['leasedAt'] = $now;
            $agent['requests'][$id]['startedAt'] ??= $now;

            json_response([
                'request' => [
                    'requestId' => $id,
                    'command' => $request['command'],
                ],
            ]);
        }

        json_response([
            'request' => null,
        ]);
    }

    if ($operation !== 'status') {
        api_error('Unknown agent operation.', 422, 'invalid_operation');
    }

    $requestId = $_GET['requestId'] ?? null;

    if (!is_string($requestId) || !preg_match('/^[a-f0-9]{24}$/D', $requestId)) {
        api_error('A valid requestId is required.', 422, 'invalid_request_id');
    }

    $request = $agent['requests'][$requestId] ?? null;

    if (!is_array($request)) {
        api_error('Agent request was not found.', 404, 'request_not_found');
    }

    json_response([
        'request' => $publicRequest($request),
    ]);
}

$input = json_input();
$operation = is_string($input['operation'] ?? null)
    ? $input['operation']
    : 'enqueue';

if ($operation === 'register') {
    $editorInstance = $validInstance($input['editorInstance'] ?? null);
    $manifest = $input['manifest'] ?? null;
    $state = $input['state'] ?? null;

    if (!is_array($manifest) || !is_array($manifest['actions'] ?? null)) {
        api_error('A valid editor action manifest is required.', 422, 'invalid_manifest');
    }

    if (!is_array($state)) {
        api_error('A valid editor state snapshot is required.', 422, 'invalid_editor_state');
    }

    $agent['manifest'] = $manifest;
    $agent['state'] = $state;
    $agent['editorInstance'] = $editorInstance;
    $agent['registeredAt'] = $now;

    json_response([
        'registered' => true,
        'editorInstance' => $editorInstance,
    ]);
}

if ($operation === 'complete') {
    $requestId = $input['requestId'] ?? null;
    $editorInstance = $validInstance($input['editorInstance'] ?? null);

    if (!is_string($requestId) || !preg_match('/^[a-f0-9]{24}$/D', $requestId)) {
        api_error('A valid requestId is required.', 422, 'invalid_request_id');
    }

    $request = $agent['requests'][$requestId] ?? null;

    if (!is_array($request)) {
        api_error('Agent request was not found.', 404, 'request_not_found');
    }

    if (
        ($request['status'] ?? '') !== 'running' ||
        ($request['editorInstance'] ?? null) !== $editorInstance
    ) {
        api_error('Agent request is not leased by this editor.', 409, 'request_lease_mismatch');
    }

    $ok = (bool) ($input['ok'] ?? false);
    $state = $input['state'] ?? null;

    if ($state !== null && !is_array($state)) {
        api_error('Invalid editor state snapshot.', 422, 'invalid_editor_state');
    }

    $agent['requests'][$requestId]['status'] = 'completed';
    $agent['requests'][$requestId]['completedAt'] = $now;
    $agent['requests'][$requestId]['ok'] = $ok;
    $agent['requests'][$requestId]['result'] = $ok
        ? ($input['result'] ?? null)
        : null;
    $agent['requests'][$requestId]['error'] = $ok
        ? null
        : (is_string($input['error'] ?? null) ? $input['error'] : 'Editor action failed.');
    $agent['requests'][$requestId]['state'] = $state;
    $agent['state'] = $state ?? $agent['state'];

    json_response([
        'request' => $publicRequest($agent['requests'][$requestId]),
    ]);
}

if ($operation !== 'enqueue') {
    api_error('Unknown agent operation.', 422, 'invalid_operation');
}

$command = $input['command'] ?? null;

if ($command === null && (isset($input['action']) || isset($input['actions']))) {
    $command = $input;
    unset($command['operation']);
}

if (!is_array($command)) {
    api_error('A JSON editor command or batch is required.', 422, 'invalid_command');
}

$encoded = json_encode(
    $command,
    JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
);

if (strlen($encoded) > SPEECH_EDITOR_AGENT_MAX_COMMAND_BYTES) {
    api_error('Editor command is too large.', 413, 'command_too_large');
}

if (
    !is_string($command['action'] ?? null) &&
    !is_array($command['actions'] ?? null)
) {
    api_error('Editor command must contain action or actions.', 422, 'invalid_command');
}

if (is_array($command['actions'] ?? null)) {
    if (!array_is_list($command['actions']) || count($command['actions']) > 100) {
        api_error('Editor action batches are limited to 100 actions.', 422, 'invalid_command');
    }
}

while (count($agent['requests']) >= SPEECH_EDITOR_AGENT_MAX_REQUESTS) {
    $oldest = array_key_first($agent['requests']);

    if ($oldest === null) {
        break;
    }

    unset($agent['requests'][$oldest]);
}

$requestId = bin2hex(random_bytes(12));

$agent['requests'][$requestId] = [
    'requestId' => $requestId,
    'status' => 'pending',
    'createdAt' => $now,
    'command' => $command,
];

json_response([
    'requestId' => $requestId,
    'status' => 'pending',
], 202);
