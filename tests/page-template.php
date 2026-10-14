<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/PageTemplate.php';
$root = dirname(__DIR__);
function check(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
foreach (['index','order-filler','drop-in'] as $name) {
    $page = PageTemplate::expand($root, file_get_contents($root . '/templates/' . $name . '.html'));
    check(str_contains($page, '<!doctype html>'), 'Shared document is missing.');
    check(substr_count($page, 'id="userLookupDialog"') === 1, 'Shared profile dialog must appear once.');
    check(substr_count($page, 'id="appVersion"') === 1, 'Version must appear once.');
    check(!str_contains($page, '{{include:') && !str_contains($page, '{{page:'), 'Composition was incomplete.');
}
foreach (['{{page:unknown}}','{{include:../index.html}}','{{include:/index.html}}','{{include:../lib/LanguageTemplate.php}}'] as $bad) {
    $rejected = false;
    try { PageTemplate::expand($root, $bad); } catch (RuntimeException $error) { $rejected = true; }
    check($rejected, 'Unsafe or unknown template was accepted.');
}
$fixture = sys_get_temp_dir() . '/clocktimer-page-' . bin2hex(random_bytes(8));
mkdir($fixture . '/templates', 0700, true);
try {
    file_put_contents($fixture . '/templates/cycle.html', '{{include:cycle.html}}');
    $rejected = false;
    try { PageTemplate::expand($fixture, '{{include:cycle.html}}'); } catch (RuntimeException $error) { $rejected = true; }
    check($rejected, 'Cyclic template was accepted.');
} finally {
    unlink($fixture . '/templates/cycle.html'); rmdir($fixture . '/templates'); rmdir($fixture);
}
echo "PASS PHP shared documents, sub-template composition, path restrictions and cycle rejection\n";
