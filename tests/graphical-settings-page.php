<?php
declare(strict_types=1);
ob_start();
require __DIR__ . '/../graphical-settings.php';
$html = ob_get_clean();
if (substr_count($html, 'id="graphicalSettingsDialog"') !== 1
    || !str_contains($html, 'GraphicalSettingsPage.js')
    || str_contains($html, '<script src="app.js')
    || str_contains($html, 'id="app"')
    || preg_match('/\{\{(?:page|include|locale|text|language-pack)/', $html)) {
    throw new RuntimeException('Standalone graphical settings did not render independently.');
}
echo "PASS standalone graphical settings PHP composition and independent runtime\n";
