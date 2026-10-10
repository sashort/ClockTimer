<?php
declare(strict_types=1);

function validate_settings_changes(mixed $namespace, mixed $changes): array
{
    if (!is_string($namespace) || !in_array($namespace, ['orderFiller', 'dropIn', 'speech'], true)) {
        throw new InvalidArgumentException('Unknown settings namespace.');
    }
    if (!is_array($changes) || array_is_list($changes) || count($changes) > 100) {
        throw new InvalidArgumentException('Settings changes must be an object with at most 100 entries.');
    }
    foreach ($changes as $key => $value) {
        if (!is_string($key) || !preg_match('/^[A-Za-z][A-Za-z0-9._-]{0,100}$/D', $key)) {
            throw new InvalidArgumentException('Invalid settings key.');
        }
    }
    if (strlen(json_encode($changes, JSON_THROW_ON_ERROR)) > 262144) {
        throw new InvalidArgumentException('Settings are too large.');
    }
    return $changes;
}

function merge_user_settings(?string $json, string $namespace, array $changes): array
{
    $settings = $json ? json_decode($json, true, 32, JSON_THROW_ON_ERROR) : ['version' => 1];
    if (!is_array($settings) || ($settings['version'] ?? null) !== 1) {
        throw new RuntimeException('Unsupported user settings version.');
    }
    $section = $settings[$namespace] ?? [];
    foreach ($changes as $key => $value) {
        if ($value === null) unset($section[$key]);
        else $section[$key] = $value;
    }
    $settings[$namespace] = $section;
    if (strlen(json_encode($settings, JSON_THROW_ON_ERROR)) > 1048576) {
        throw new InvalidArgumentException('Account settings are too large.');
    }
    return $settings;
}
