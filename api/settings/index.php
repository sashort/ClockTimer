<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/_core/bootstrap.php';
require_once dirname(__DIR__) . '/_core/user_settings.php';
$method = require_method('GET', 'PATCH');
$userId = (int) current_user()['id'];
if ($method === 'GET') {
    $query = db()->prepare('SELECT settings_json, settings_revision FROM users WHERE id = :id');
    $query->execute([':id' => $userId]);
    $row = $query->fetch();
    json_response(['userId' => $userId, 'revision' => (int) $row['settings_revision'],
        'settings' => $row['settings_json'] ? json_decode($row['settings_json'], true, 32, JSON_THROW_ON_ERROR) : ['version' => 1]]);
}
require_csrf();
$input = json_input();
try {
    $changes = validate_settings_changes($input['namespace'] ?? null, $input['changes'] ?? null);
} catch (InvalidArgumentException $error) {
    api_error($error->getMessage(), 422, 'invalid_settings');
}
if (!is_int($input['userId'] ?? null) || $input['userId'] !== $userId) {
    api_error('Settings belong to a different signed-in account.', 409, 'settings_owner_changed');
}
$result = audited_write(static function (PDO $pdo) use ($userId, $input, $changes): array {
    $query = $pdo->prepare('SELECT settings_json, settings_revision FROM users WHERE id = :id FOR UPDATE');
    $query->execute([':id' => $userId]);
    $row = $query->fetch();
    $settings = merge_user_settings($row['settings_json'], $input['namespace'], $changes);
    $revision = (int) $row['settings_revision'] + 1;
    $save = $pdo->prepare('UPDATE users SET settings_json = :settings, settings_revision = :revision WHERE id = :id');
    $save->execute([':settings' => json_encode($settings, JSON_THROW_ON_ERROR), ':revision' => $revision, ':id' => $userId]);
    return ['userId' => $userId, 'revision' => $revision, 'settings' => $settings];
});
json_response($result);
