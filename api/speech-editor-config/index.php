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
    if (!is_file($path)) return ['entries' => [], 'macros' => [], 'revision' => 'empty'];
    $raw = file_get_contents($path);
    if ($raw === false) api_error('Speech configuration could not be read.', 500, 'read_failed');
    $data = json_decode($raw, true);
    if (!is_array($data) || !is_array($data['entries'] ?? null)) api_error('Speech configuration is invalid.', 500, 'invalid_config');
    $macros = $data['macros'] ?? [];
    if (!is_array($macros) || !array_is_list($macros)) api_error('Speech macro configuration is invalid.', 500, 'invalid_config');
    return ['entries' => $data['entries'], 'macros' => $macros, 'revision' => hash('sha256', $raw)];
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

    $json = preg_replace(
        '/([,{]\s*)([A-Za-z][A-Za-z0-9_-]*)(\s*:)/',
        '$1"$2"$3',
        $match[1]
    );

    $decoded = is_string($json)
        ? json_decode($json, true)
        : null;

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
$macros = $input['macros'] ?? null;
$functionRoles = $input['functionRoles'] ?? null;

if (!is_array($entries) || !array_is_list($entries) || count($entries) > 250) {
    api_error('Invalid speech entries.', 422, 'invalid_entries');
}

if (!is_array($macros) || !array_is_list($macros) || count($macros) > 100) {
    api_error('Invalid speech macros.', 422, 'invalid_macros');
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

$actionVerbPattern = '/^(?:add|apply|begin|cancel|change|choose|clear|close|confirm|connect|continue|create|cycle|delete|defer|disable|disconnect|edit|enable|end|enter|hide|load|lock|move|open|prepare|release|remove|reorder|request|reset|resume|run|save|schedule|select|set|show|start|stop|submit|switch|toggle|unlock|update)/D';
$identifierPattern = '/^[A-Za-z_$][\\w$]*$/D';
$contextPattern = '/^(?:[A-Za-z_$][\\w$]*)(?:\\.[A-Za-z_$][\\w$]*)*$/D';

$containsUnsupportedMacroLiteral = static function (mixed $value) use (&$containsUnsupportedMacroLiteral): bool {
    if (!is_array($value)) return false;
    if (isset($value['__wmofMacroUnsupported'])) return true;
    foreach ($value as $child) {
        if ($containsUnsupportedMacroLiteral($child)) return true;
    }
    return false;
};

$currentMacroNames = [];
foreach (($current['macros'] ?? []) as $currentMacro) {
    if (is_array($currentMacro) && is_string($currentMacro['name'] ?? null)) {
        $currentMacroNames['WMOFActions.' . $currentMacro['name']] = true;
    }
}

$nativeActionNames = [];
foreach (($currentRegistry['functionRoles']['action'] ?? []) as $registeredAction) {
    if (is_string($registeredAction) && !isset($currentMacroNames[$registeredAction])) {
        $nativeActionNames[$registeredAction] = true;
    }
}

$macroNames = [];
foreach ($macros as $macro) {
    if (!is_array($macro)) api_error('Invalid macro.', 422, 'invalid_macro');

    $macroName = $macro['name'] ?? null;
    if (
        !is_string($macroName) ||
        !preg_match($identifierPattern, $macroName) ||
        !preg_match($actionVerbPattern, $macroName)
    ) {
        api_error('Macro names must be valid action names that start with a verb.', 422, 'invalid_macro_name');
    }

    if (isset($macroNames[$macroName])) {
        api_error('Macro names must be unique.', 422, 'duplicate_macro_name');
    }

    if (isset($nativeActionNames['WMOFActions.' . $macroName])) {
        api_error('A native action function already uses this macro name.', 422, 'macro_name_collision');
    }

    $macroNames[$macroName] = true;

    $parameters = $macro['parameters'] ?? null;
    $steps = $macro['steps'] ?? null;

    if (!is_array($parameters) || !array_is_list($parameters) || count($parameters) > 50) {
        api_error('Invalid macro parameters.', 422, 'invalid_macro');
    }

    if (!is_array($steps) || !array_is_list($steps) || count($steps) < 1 || count($steps) > 200) {
        api_error('A macro needs between 1 and 200 actions.', 422, 'invalid_macro');
    }

    $parameterNames = [];

    foreach ($parameters as $parameter) {
        if (!is_array($parameter)) api_error('Invalid macro parameter.', 422, 'invalid_macro');

        $parameterName = $parameter['name'] ?? null;
        $parameterType = $parameter['type'] ?? 'value';

        if (
            !is_string($parameterName) ||
            !preg_match($identifierPattern, $parameterName) ||
            isset($parameterNames[$parameterName])
        ) {
            api_error('Macro parameter names must be unique valid identifiers.', 422, 'invalid_macro_parameter');
        }

        if (!is_string($parameterType) || strlen($parameterType) > 50) {
            api_error('Invalid macro parameter type.', 422, 'invalid_macro_parameter');
        }

        if (
            array_key_exists('default', $parameter) &&
            $containsUnsupportedMacroLiteral($parameter['default'])
        ) {
            api_error('Macro parameter defaults must be serializable.', 422, 'invalid_macro_parameter');
        }

        $parameterNames[$parameterName] = true;
    }

    foreach ($steps as $step) {
        if (!is_array($step)) api_error('Invalid macro action.', 422, 'invalid_macro_step');

        $action = $step['action'] ?? null;
        $args = $step['args'] ?? null;

        if (!is_string($action) || !preg_match($identifierPattern, $action)) {
            api_error('Macro actions must reference valid action function names.', 422, 'invalid_macro_step');
        }

        if ($action === $macroName) {
            api_error('A macro cannot call itself.', 422, 'recursive_macro');
        }

        if (!is_array($args) || !array_is_list($args) || count($args) > 30) {
            api_error('Invalid macro action arguments.', 422, 'invalid_macro_step');
        }

        foreach ($args as $argument) {
            if (!is_array($argument)) api_error('Invalid macro argument.', 422, 'invalid_macro_argument');

            $source = $argument['source'] ?? 'literal';

            if (!in_array($source, ['literal', 'parameter', 'context'], true)) {
                api_error('Invalid macro argument source.', 422, 'invalid_macro_argument');
            }

            if ($source === 'parameter') {
                $name = $argument['name'] ?? null;
                if (!is_string($name) || !isset($parameterNames[$name])) {
                    api_error('Macro argument references an unknown parameter.', 422, 'invalid_macro_argument');
                }
            }

            if ($source === 'context') {
                $pathValue = $argument['path'] ?? '';
                if (
                    !is_string($pathValue) ||
                    (
                        $pathValue !== '' &&
                        !preg_match($contextPattern, $pathValue)
                    )
                ) {
                    api_error('Invalid macro context path.', 422, 'invalid_macro_argument');
                }
            }

            if (
                $source === 'literal' &&
                $containsUnsupportedMacroLiteral($argument['value'] ?? null)
            ) {
                api_error('Recorded arguments must be converted to parameters or context before saving.', 422, 'invalid_macro_argument');
            }
        }
    }
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

$encoded = json_encode(['entries' => $entries, 'macros' => $macros], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
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
    'macros' => $macros,
    'revision' => hash('sha256', $encoded),
    'functionRoles' => $normalizedRoles,
    'registryRevision' => hash('sha256', $registryEncoded)
]);
