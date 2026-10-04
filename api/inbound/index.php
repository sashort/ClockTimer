<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_core/bootstrap.php';

require_method('POST');

// Inbound is intentionally a raw-stream endpoint. The caller must present a
// Bearer access token with Developer permission. A one-use token can therefore
// be issued for a single file transfer without adding another authentication
// mechanism to the application.
$bearer = access_token_bearer();
if ($bearer === null) {
    api_error('A Bearer access token is required.', 401, 'unauthorized');
}

$authorization = consume_access_token(
    $bearer,
    [PERMISSION_DEVELOPER],
    ACCESS_TOKEN_SCOPE_ACCESS_TOKENS,
    false,
    'token_bearer'
);

$filename = trim((string) ($_SERVER['HTTP_X_FILENAME'] ?? ''));
if ($filename === '') {
    api_error('X-Filename is required.', 400, 'filename_required');
}

// Only accept a plain filename. The endpoint must never accept a path supplied
// by the caller, including traversal or absolute paths.
if (
    $filename === '.' ||
    $filename === '..' ||
    str_contains($filename, '/') ||
    str_contains($filename, '\\') ||
    str_contains($filename, "\0") ||
    str_contains($filename, ':') ||
    preg_match('/[\x00-\x1F\x7F]/', $filename)
) {
    api_error('The filename must be a simple filename.', 400, 'invalid_filename');
}

if (strlen($filename) > 255) {
    api_error('The filename is too long.', 400, 'invalid_filename');
}

$inboundDirectory = dirname(__DIR__, 2) . '/inbound';
if (!is_dir($inboundDirectory) && !mkdir($inboundDirectory, 0700, true) && !is_dir($inboundDirectory)) {
    api_error('The inbound directory could not be created.', 500, 'inbound_directory_failed');
}

if (!is_writable($inboundDirectory)) {
    api_error('The inbound directory is not writable.', 500, 'inbound_directory_not_writable');
}

$destination = $inboundDirectory . '/' . $filename;
if (file_exists($destination)) {
    api_error('A file with that name already exists in inbound.', 409, 'file_exists');
}

$maxBytes = 20 * 1024 * 1024;
$contentLength = $_SERVER['CONTENT_LENGTH'] ?? null;
if ($contentLength !== null && ctype_digit((string) $contentLength) && (int) $contentLength > $maxBytes) {
    api_error('The uploaded file is too large.', 413, 'file_too_large');
}

$input = fopen('php://input', 'rb');
if ($input === false) {
    api_error('The request body could not be opened.', 400, 'request_body_unavailable');
}

$tempPath = tempnam($inboundDirectory, '.upload-');
if ($tempPath === false) {
    fclose($input);
    api_error('A temporary inbound file could not be created.', 500, 'temporary_file_failed');
}

$output = fopen($tempPath, 'wb');
if ($output === false) {
    fclose($input);
    @unlink($tempPath);
    api_error('The temporary inbound file could not be opened.', 500, 'temporary_file_failed');
}

$hash = hash_init('sha256');
$bytes = 0;
$success = false;

try {
    while (!feof($input)) {
        $chunk = fread($input, 1024 * 1024);
        if ($chunk === false) {
            throw new RuntimeException('The request body could not be read.');
        }

        if ($chunk === '') {
            continue;
        }

        $chunkLength = strlen($chunk);
        $bytes += $chunkLength;

        if ($bytes > $maxBytes) {
            http_response_code(413);
            throw new RuntimeException('The uploaded file is too large.');
        }

        if (fwrite($output, $chunk) !== $chunkLength) {
            throw new RuntimeException('The inbound file could not be written.');
        }

        hash_update($hash, $chunk);
    }

    if (!fflush($output)) {
        throw new RuntimeException('The inbound file could not be flushed.');
    }

    if (function_exists('fsync')) {
        fsync($output);
    }

    fclose($output);
    fclose($input);
    $output = null;
    $input = null;

    if (!rename($tempPath, $destination)) {
        throw new RuntimeException('The inbound file could not be finalized.');
    }

    $tempPath = null;
    $success = true;

    json_response([
        'success' => true,
        'filename' => $filename,
        'bytes' => $bytes,
        'sha256' => hash_final($hash),
        'path' => 'inbound/' . $filename,
        'token_id' => (int) ($authorization['token_id'] ?? 0),
        'uses_remaining' => $authorization['uses_remaining'] ?? null,
    ], 201);
} catch (Throwable $error) {
    if (is_resource($output)) {
        fclose($output);
    }

    if (is_resource($input)) {
        fclose($input);
    }

    if (is_string($tempPath) && $tempPath !== '') {
        @unlink($tempPath);
    }

    if (http_response_code() !== 413) {
        error_log('Inbound upload failed: ' . $error->getMessage());
        api_error('The file could not be saved.', 500, 'inbound_write_failed');
    }

    api_error('The uploaded file is too large.', 413, 'file_too_large');
} finally {
    if (!$success && is_string($tempPath) && $tempPath !== '') {
        @unlink($tempPath);
    }
}
