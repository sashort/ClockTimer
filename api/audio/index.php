<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_core/bootstrap.php';

require_method('GET');

$path = __DIR__ . '/catalog.json';
$raw = file_get_contents($path);

if ($raw === false) {
    api_error('Audio catalog could not be read.', 500, 'audio_catalog_read_failed');
}

$catalog = json_decode($raw, true);

if (!is_array($catalog)) {
    api_error('Audio catalog is invalid.', 500, 'invalid_audio_catalog');
}

json_response($catalog);
