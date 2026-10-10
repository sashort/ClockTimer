<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_core/bootstrap.php';
require_once dirname(__DIR__) . '/_core/developer_docs.php';

require_method('GET');

require_any_permission(
    PERMISSION_DEVELOPER_PREVIEW,
    PERMISSION_DEVELOPER
);

$root = developer_docs_root();
$requested = $_GET['path'] ?? '';

if (!is_string($requested)) {
    api_error('path must be a string.', 422, 'invalid_argument');
}

header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');

if ($requested === '') {
    $files = developer_docs_list($root);

    header('Content-Type: text/html; charset=utf-8');
    header(
        "Content-Security-Policy: default-src 'none'; "
        . "style-src 'unsafe-inline'; "
        . "img-src data:; "
        . "base-uri 'none'; "
        . "form-action 'none'; "
        . "frame-ancestors 'self'"
    );

    ?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Developer Documentation</title>
<style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body {
    margin: 0;
    font: 16px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    color: #f7fbff;
    background: #001e60;
}
main {
    width: min(960px, calc(100% - 32px));
    margin: 32px auto;
}
h1 { margin: 0 0 8px; }
p { color: #a9ddf7; }
ul {
    margin: 24px 0;
    padding: 0;
    display: grid;
    gap: 10px;
    list-style: none;
}
a {
    display: grid;
    grid-template-columns: minmax(0,1fr) auto;
    gap: 16px;
    padding: 14px 16px;
    border: 1px solid rgb(255 255 255 / 35%);
    border-radius: 10px;
    color: white;
    background: rgb(255 255 255 / 8%);
    text-decoration: none;
}
a:hover,a:focus-visible { background: rgb(255 255 255 / 14%); }
small { color: #a9ddf7; }
</style>
</head>
<body>
<main>
<h1>Developer Documentation</h1>
<p>Files in <code>docs/</code> are protected from direct web access and are served through this permission-checked endpoint.</p>
<ul>
<?php foreach ($files as $file): ?>
<li>
<a href="?path=<?=rawurlencode((string) $file['path'])?>">
<span><?=htmlspecialchars((string) $file['path'], ENT_QUOTES)?></span>
<small><?=number_format(((int) $file['size']) / 1024, 1)?> KB</small>
</a>
</li>
<?php endforeach; ?>
</ul>
</main>
</body>
</html><?php
    exit;
}

$file = developer_docs_resolve_file($root, $requested);

if ($file === null) {
    api_error('Documentation file was not found.', 404, 'doc_not_found');
}

$extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));

if ($extension === 'php') {
    header('Content-Type: text/html; charset=utf-8');
    header(
        "Content-Security-Policy: default-src 'self' data:; "
        . "style-src 'self' 'unsafe-inline'; "
        . "script-src 'self' 'unsafe-inline'; "
        . "img-src 'self' data:; "
        . "base-uri 'self'; "
        . "frame-ancestors 'self'"
    );

    $previousDirectory = getcwd();

    try {
        chdir(dirname($file));
        require $file;
    } finally {
        if (is_string($previousDirectory)) {
            chdir($previousDirectory);
        }
    }

    exit;
}

header('Content-Type: ' . developer_docs_content_type($file));

if (in_array($extension, ['html', 'htm'], true)) {
    header(
        "Content-Security-Policy: default-src 'self' data:; "
        . "style-src 'self' 'unsafe-inline'; "
        . "script-src 'self' 'unsafe-inline'; "
        . "img-src 'self' data:; "
        . "base-uri 'self'; "
        . "frame-ancestors 'self'"
    );
}

$size = filesize($file);

if ($size !== false) {
    header('Content-Length: ' . (string) $size);
}

$stream = fopen($file, 'rb');

if ($stream === false) {
    api_error('Documentation file could not be opened.', 500, 'doc_read_failed');
}

fpassthru($stream);
fclose($stream);
