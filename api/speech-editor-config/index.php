<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_core/bootstrap.php';

$method = require_method('GET', 'PUT');
$root = dirname(__DIR__, 2);
$path = $root . '/database/speech-editor.json';
$registryPath = $root . '/SpeechFunctionRoles.js';
$roleNames = ['speech-processing', 'action', 'interaction', 'presentation', 'helper'];
$defaultFunctionRoles = [
    'speech-processing' => ['WMOFSpeechProcessing.normalizeSpeechValue'],
    'action' => [],
    'interaction' => [],
    'presentation' => [],
    'helper' => []
];

$read = static function () use ($path): array {
    if (!is_file($path)) return ['entries' => [], 'revision' => 'empty'];
    $raw = file_get_contents($path);
    if ($raw === false) api_error('Speech configuration could not be read.', 500, 'read_failed');
    $data = json_decode($raw, true);
    if (!is_array($data) || !is_array($data['entries'] ?? null)) api_error('Speech configuration is invalid.', 500, 'invalid_config');
    return ['entries' => $data['entries'], 'revision' => hash('sha256', $raw)];
};

$normalizeRoles = static function (mixed $value) use ($roleNames): array {
    if (!is_array($value)) api_error('Speech function registry is invalid.', 500, 'invalid_registry');

    $roles = [];
    foreach ($roleNames as $role) {
        $names = $value[$role] ?? [];
        if (!is_array($names) || !array_is_list($names)) api_error('Speech function registry is invalid.', 500, 'invalid_registry');
        $roles[$role] = array_values($names);
    }

    return $roles;
};

$readRegistry = static function () use ($registryPath, $defaultFunctionRoles, $normalizeRoles): array {
    if (!is_file($registryPath)) {
        return [
            'functionRoles' => $defaultFunctionRoles,
            'registryRevision' => 'missing'
        ];
    }

    $raw = file_get_contents($registryPath);
    if ($raw === false) api_error('Speech function roles could not be read.', 500, 'registry_read_failed');

    if (!preg_match('/globalThis\.WMOFSpeechFunctionRoles\s*=\s*(\{[\s\S]*?\})\s*;/D', $raw, $match)) {
        api_error('Speech function roles are invalid.', 500, 'invalid_registry');
    }

    $decoded = json_decode($match[1], true);
    $roles = $normalizeRoles($decoded);

    return [
        'functionRoles' => $roles,
        'registryRevision' => hash('sha256', $raw)
    ];
};

$renderRegistry = static function (array $roles): string {
    $encoded = json_encode(
        $roles,
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
    );

    return "globalThis.WMOFSpeechFunctionRoles = " . $encoded . ";\n";
};

if ($method === 'GET') {
    json_response(array_merge($read(), $readRegistry()));
}

authenticated_user_id();
require_permission(PERMISSION_SUPERUSER);
require_csrf();

$input = json_input();
$entries = $input['entries'] ?? null;
$functionRoles = $input['functionRoles'] ?? null;

if (!is_array($entries) || !array_is_list($entries) || count($entries) > 250) {
    api_error('Invalid speech entries.', 422, 'invalid_entries');
}

if (!is_array($functionRoles)) {
    api_error('Invalid speech function roles.', 422, 'invalid_function_roles');
}

$current = $read();
$currentRegistry = $readRegistry();

if (!is_string($input['revision'] ?? null) || !hash_equals($current['revision'], $input['revision'])) {
    api_error('Speech commands changed since this editor opened. Reload before saving.', 409, 'stale_revision');
}

if (
    !is_string($input['registryRevision'] ?? null) ||
    !hash_equals($currentRegistry['registryRevision'], $input['registryRevision'])
) {
    api_error('Speech function roles changed since this editor opened. Reload before saving.', 409, 'stale_registry_revision');
}

$allowedAttributes = ['speech-pattern', 'speech-function', 'speech-preproc', 'speech-preproc-context', 'speech-preproc-field', 'speech-modal', 'speech-index'];
$seen = [];

foreach ($entries as $entry) {
    if (!is_array($entry) || !is_string($entry['id'] ?? null) || !preg_match('/^[A-Za-z0-9:_-]{1,100}$/D', $entry['id']) || isset($seen[$entry['id']])) api_error('Each entry needs a unique ID.', 422, 'invalid_entry');
    $seen[$entry['id']] = true;
    if (!in_array($entry['kind'] ?? null, ['attribute', 'command', 'menu', 'modal', 'existing'], true)) api_error('Invalid element type.', 422, 'invalid_entry');
    if (!is_string($entry['target'] ?? null) || strlen($entry['target']) > 250 || $entry['target'] === '') api_error('Invalid target selector.', 422, 'invalid_entry');
    if (!is_array($entry['attrs'] ?? null) || array_diff(array_keys($entry['attrs']), $allowedAttributes)) api_error('Invalid speech attributes.', 422, 'invalid_entry');

    foreach ($entry['attrs'] as $name => $value) {
        if (!is_string($value) || strlen($value) > 500 || str_contains($value, "\0")) api_error('Invalid speech attribute value.', 422, 'invalid_entry');
        if ($name === 'speech-pattern' && $value !== '' && @preg_match('~' . str_replace('~', '\\~', $value) . '~i', '') === false) api_error('Invalid speech pattern.', 422, 'invalid_pattern');
        if (in_array($name, ['speech-function', 'speech-preproc'], true) && $value !== '' && !preg_match('/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/D', $value)) api_error('Invalid function name.', 422, 'invalid_function');
        if ($name === 'speech-index' && $value !== '' && !preg_match('/^-?(?:\d+|\d*\.\d+)$/D', $value)) api_error('speech-index must be numeric.', 422, 'invalid_speech_index');
    }

    if (isset($entry['parentId']) && (!is_string($entry['parentId']) || strlen($entry['parentId']) > 100)) api_error('Invalid parent element.', 422, 'invalid_entry');
    if (isset($entry['order']) && (!is_int($entry['order']) || $entry['order'] < 0 || $entry['order'] > 10000)) api_error('Invalid speech element order.', 422, 'invalid_entry');
}


$normalizedRoles = [];
$assigned = [];

foreach ($roleNames as $role) {
    $names = $functionRoles[$role] ?? null;

    if (!is_array($names) || !array_is_list($names) || count($names) > 500) {
        api_error('Invalid speech function role list.', 422, 'invalid_function_roles');
    }

    $unique = [];

    foreach ($names as $name) {
        if (!is_string($name) || !preg_match('/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/D', $name)) {
            api_error('Invalid speech function name.', 422, 'invalid_function_role');
        }

        if (isset($assigned[$name]) && $assigned[$name] !== $role) {
            api_error('A function can only have one speech-editor role.', 422, 'duplicate_function_role');
        }

        $assigned[$name] = $role;
        $unique[$name] = true;
    }

    $names = array_keys($unique);
    natcasesort($names);
    $normalizedRoles[$role] = array_values($names);
}

$encoded = json_encode(['entries' => $entries], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
$registryEncoded = $renderRegistry(
    $normalizedRoles
);

$configTemporary = tempnam(dirname($path), '.speech-editor-');

if (
    $configTemporary === false ||
    file_put_contents($configTemporary, $encoded, LOCK_EX) === false
) {
    api_error('Speech configuration could not be saved.', 500, 'write_failed');
}

if (file_put_contents($registryPath, $registryEncoded, LOCK_EX) === false) {
    @unlink($configTemporary);
    api_error('Speech function roles could not be saved.', 500, 'registry_write_failed');
}

if (!rename($configTemporary, $path)) {
    @unlink($configTemporary);
    api_error('Speech configuration could not be saved.', 500, 'write_failed');
}

json_response([
    'entries' => $entries,
    'revision' => hash('sha256', $encoded),
    'functionRoles' => $normalizedRoles,
    'registryRevision' => hash('sha256', $registryEncoded)
]);
