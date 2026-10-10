<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/LanguageTemplate.php';
try {
    $language = new LanguageTemplate(__DIR__, $_GET['lang'] ?? null);
    $template = file_get_contents(__DIR__ . '/templates/drop-in.html');
    if ($template === false) throw new RuntimeException('Page template could not be read.');
    $page = $language->render($template);
    if (preg_match('/\{\{(?:locale|language-pack|language-rules|text|speech|options)\b/', $page)) throw new RuntimeException('Unresolved language template placeholder.');
    if (PHP_SAPI !== 'cli') {
        header('Content-Type: text/html; charset=UTF-8');
        header('Content-Language: ' . $language->locale());
    }
    echo $page;
} catch (Throwable $error) {
    error_log('Language page rendering failed: ' . $error->getMessage());
    if (PHP_SAPI !== 'cli') http_response_code(500);
    echo '<!doctype html><html lang="en"><meta charset="utf-8"><title>Page unavailable</title><p>The page could not be loaded. Please reload.</p></html>';
}
