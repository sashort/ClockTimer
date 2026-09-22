<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_core/bootstrap.php';

$method = require_method('GET', 'PUT');
$path = dirname(__DIR__, 2) . '/database/speech-editor.json';
$read = static function () use ($path): array {
    if (!is_file($path)) return ['entries' => [], 'revision' => 'empty'];
    $raw = file_get_contents($path);
    if ($raw === false) api_error('Speech configuration could not be read.', 500, 'read_failed');
    $data = json_decode($raw, true);
    if (!is_array($data) || !is_array($data['entries'] ?? null)) api_error('Speech configuration is invalid.', 500, 'invalid_config');
    return ['entries' => $data['entries'], 'revision' => hash('sha256', $raw)];
};

if ($method === 'GET') json_response($read());

authenticated_user_id();
require_permission(PERMISSION_SUPERUSER);
require_csrf();
$input = json_input();
$entries = $input['entries'] ?? null;
if (!is_array($entries) || !array_is_list($entries) || count($entries) > 250) api_error('Invalid speech entries.', 422, 'invalid_entries');
if (!is_string($input['revision'] ?? null) || !hash_equals($read()['revision'], $input['revision'])) api_error('Speech commands changed since this editor opened. Reload before saving.', 409, 'stale_revision');
$allowedAttributes = ['speech-pattern', 'speech-function', 'speech-preproc', 'speech-preproc-context', 'speech-preproc-field', 'speech-modal'];
$seen = [];
foreach ($entries as $entry) {
    if (!is_array($entry) || !is_string($entry['id'] ?? null) || !preg_match('/^[A-Za-z0-9:_-]{1,100}$/D', $entry['id']) || isset($seen[$entry['id']])) api_error('Each entry needs a unique ID.', 422, 'invalid_entry');
    $seen[$entry['id']] = true;
    if (!in_array($entry['kind'] ?? null, ['attribute', 'command', 'modal', 'existing'], true)) api_error('Invalid element type.', 422, 'invalid_entry');
    if (!is_string($entry['target'] ?? null) || strlen($entry['target']) > 250 || $entry['target'] === '') api_error('Invalid target selector.', 422, 'invalid_entry');
    if (!is_array($entry['attrs'] ?? null) || array_diff(array_keys($entry['attrs']), $allowedAttributes)) api_error('Invalid speech attributes.', 422, 'invalid_entry');
    foreach ($entry['attrs'] as $name => $value) {
        if (!is_string($value) || strlen($value) > 500 || str_contains($value, "\0")) api_error('Invalid speech attribute value.', 422, 'invalid_entry');
        if ($name === 'speech-pattern' && $value !== '' && @preg_match('~' . str_replace('~', '\\~', $value) . '~i', '') === false) api_error('Invalid speech pattern.', 422, 'invalid_pattern');
        if (in_array($name, ['speech-function', 'speech-preproc'], true) && $value !== '' && !preg_match('/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/D', $value)) api_error('Invalid function name.', 422, 'invalid_function');
    }
    if (isset($entry['parentId']) && (!is_string($entry['parentId']) || strlen($entry['parentId']) > 100)) api_error('Invalid parent element.', 422, 'invalid_entry');
}
$encoded = json_encode(['entries' => $entries], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
$temporary = tempnam(dirname($path), '.speech-editor-');
if ($temporary === false || file_put_contents($temporary, $encoded, LOCK_EX) === false || !rename($temporary, $path)) api_error('Speech configuration could not be saved.', 500, 'write_failed');
json_response(['entries' => $entries, 'revision' => hash('sha256', $encoded)]);
