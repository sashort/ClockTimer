<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/_core/user_settings.php';
function check(bool $condition, string $message): void {if (!$condition) throw new RuntimeException($message);}
$original = ['version' => 1, 'orderFiller' => ['mode' => 'trip', 'sound' => 80], 'dropIn' => ['preferences' => 'observer']];
$changes = validate_settings_changes('orderFiller', ['mode' => 'auto']);
$result = merge_user_settings(json_encode($original), 'orderFiller', $changes);
check($result['orderFiller']['mode'] === 'auto', 'changed field saved');
check($result['orderFiller']['sound'] === 80 && $result['dropIn']['preferences'] === 'observer', 'unrelated settings preserved');
$result = merge_user_settings(json_encode($result), 'orderFiller', ['mode' => null]);
check(!isset($result['orderFiller']['mode']), 'null removes override');
foreach ([['credentials', ['x' => 1]], ['speech', [1, 2]], ['dropIn', ['bad:key' => 1]], ['orderFiller', ['huge' => str_repeat('a', 262145)]]] as [$namespace, $changes]) {
    try {validate_settings_changes($namespace, $changes);throw new RuntimeException('Invalid input accepted');}
    catch (InvalidArgumentException) {}
}
check(merge_user_settings(null, 'speech', ['names' => []])['version'] === 1, 'new accounts get versioned document');
echo "PASS validated settings namespaces, bounded payloads, partial merge and override removal\n";
