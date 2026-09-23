<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_core/bootstrap.php';

$method = require_method('GET', 'PUT');
$root = dirname(__DIR__, 2);
$path = $root . '/database/speech-editor.json';
$registryPath = $root . '/SpeechFunctionRegistry.js';
$defaultPreprocFunctions = ['WMOFSpeechPreprocess.normalize'];

$read = static function () use ($path): array {
    if (!is_file($path)) return ['entries' => [], 'revision' => 'empty'];
    $raw = file_get_contents($path);
    if ($raw === false) api_error('Speech configuration could not be read.', 500, 'read_failed');
    $data = json_decode($raw, true);
    if (!is_array($data) || !is_array($data['entries'] ?? null)) api_error('Speech configuration is invalid.', 500, 'invalid_config');
    return ['entries' => $data['entries'], 'revision' => hash('sha256', $raw)];
};

$readRegistry = static function () use ($registryPath, $defaultPreprocFunctions): array {
    if (!is_file($registryPath)) {
        return [
            'preprocFunctions' => $defaultPreprocFunctions,
            'registryRevision' => 'missing'
        ];
    }

    $raw = file_get_contents($registryPath);
    if ($raw === false) api_error('Speech function registry could not be read.', 500, 'registry_read_failed');

    if (!preg_match('/const\s+taggedPreprocFunctions\s*=\s*(\[[\s\S]*?\])\s*;/D', $raw, $match)) {
        api_error('Speech function registry is invalid.', 500, 'invalid_registry');
    }

    $names = json_decode($match[1], true);
    if (!is_array($names) || !array_is_list($names)) {
        api_error('Speech function registry is invalid.', 500, 'invalid_registry');
    }

    return [
        'preprocFunctions' => $names,
        'registryRevision' => hash('sha256', $raw)
    ];
};

$renderRegistry = static function (array $names): string {
    $encoded = json_encode(
        array_values($names),
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
    );

    $encoded = preg_replace('/^/m', '        ', $encoded);

    return <<<JS
(() => {
    "use strict";

    const taggedPreprocFunctions =
$encoded;

    const preproc =
        new Set();

    const normalize =
        value => {
            const name =
                String(value || "")
                    .trim();

            return /^[A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)*$/
                .test(name)
                    ? name
                    : "";
        };

    const tagPreproc =
        (...names) => {
            for (const value of names.flat()) {
                const name =
                    normalize(value);

                if (name) {
                    preproc.add(name);
                }
            }

            return api;
        };

    const untagPreproc =
        (...names) => {
            for (const value of names.flat()) {
                const name =
                    normalize(value);

                if (name) {
                    preproc.delete(name);
                }
            }

            return api;
        };

    const api = {
        tagPreproc,
        untagPreproc,

        isPreproc(name) {
            return preproc.has(
                normalize(name)
            );
        },

        listPreproc() {
            return [
                ...preproc
            ].sort(
                (a, b) =>
                    a.localeCompare(b)
            );
        }
    };

    tagPreproc(
        taggedPreprocFunctions
    );

    globalThis.WMOFSpeechFunctionRegistry =
        Object.freeze(api);
})();
JS;
};

if ($method === 'GET') {
    json_response(array_merge($read(), $readRegistry()));
}

authenticated_user_id();
require_permission(PERMISSION_SUPERUSER);
require_csrf();

$input = json_input();
$entries = $input['entries'] ?? null;
$preprocFunctions = $input['preprocFunctions'] ?? null;

if (!is_array($entries) || !array_is_list($entries) || count($entries) > 250) {
    api_error('Invalid speech entries.', 422, 'invalid_entries');
}

if (!is_array($preprocFunctions) || !array_is_list($preprocFunctions) || count($preprocFunctions) > 500) {
    api_error('Invalid preprocessor function list.', 422, 'invalid_preproc_functions');
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

$uniquePreproc = [];
foreach ($preprocFunctions as $name) {
    if (!is_string($name) || !preg_match('/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/D', $name)) {
        api_error('Invalid preprocessor function name.', 422, 'invalid_preproc_function');
    }
    $uniquePreproc[$name] = true;
}

$preprocFunctions = array_keys($uniquePreproc);
natcasesort($preprocFunctions);
$preprocFunctions = array_values($preprocFunctions);

$encoded = json_encode(['entries' => $entries], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
$registryEncoded = $renderRegistry($preprocFunctions) . "\n";

$configTemporary = tempnam(dirname($path), '.speech-editor-');
$registryTemporary = tempnam(dirname($registryPath), '.speech-functions-');

if (
    $configTemporary === false ||
    $registryTemporary === false ||
    file_put_contents($configTemporary, $encoded, LOCK_EX) === false ||
    file_put_contents($registryTemporary, $registryEncoded, LOCK_EX) === false
) {
    api_error('Speech configuration could not be saved.', 500, 'write_failed');
}

if (!rename($registryTemporary, $registryPath)) {
    @unlink($configTemporary);
    @unlink($registryTemporary);
    api_error('Speech function registry could not be saved.', 500, 'registry_write_failed');
}

if (!rename($configTemporary, $path)) {
    @unlink($configTemporary);
    api_error('Speech configuration could not be saved.', 500, 'write_failed');
}

json_response([
    'entries' => $entries,
    'revision' => hash('sha256', $encoded),
    'preprocFunctions' => $preprocFunctions,
    'registryRevision' => hash('sha256', $registryEncoded)
]);
