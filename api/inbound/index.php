<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_core/bootstrap.php';

function inbound_upload_authorization(): array
{
    // A logged-in superuser or developer does not need a token.
    $user = optional_current_user();
    if ($user !== null && has_any_permission($user, PERMISSION_DEVELOPER)) {
        return [
            'mode' => 'session',
            'permissions' => (int) $user['permissions'],
            'user' => $user,
            'principal_key' => 'user-' . (int) $user['id'],
        ];
    }

    // Anonymous callers, and authenticated users without the required
    // permission, may use a valid one-time token. Header and query tokens use
    // the same transactional validator/consumer.
    $queryToken = access_token_query_value();
    if ($queryToken !== null) {
        return consume_access_token(
            $queryToken,
            [PERMISSION_DEVELOPER],
            ACCESS_TOKEN_SCOPE_ACCESS_TOKENS,
            false,
            'token_query'
        );
    }

    $bearer = access_token_bearer();
    if ($bearer !== null) {
        return consume_access_token(
            $bearer,
            [PERMISSION_DEVELOPER],
            ACCESS_TOKEN_SCOPE_ACCESS_TOKENS,
            false,
            'token_bearer'
        );
    }

    if ($user !== null) {
        api_error('This operation requires a developer permission.', 403, 'permission_required');
    }

    api_error('Authentication or a valid one-time access token is required.', 401, 'unauthorized');
}

function inbound_filename(): string
{
    $filename = trim((string) ($_SERVER['HTTP_X_FILENAME'] ?? ''));
    if ($filename === '') {
        api_error('X-Filename is required.', 400, 'filename_required');
    }

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

    return $filename;
}

function handle_inbound_upload(): never
{
    $authorization = inbound_upload_authorization();
    $filename = inbound_filename();

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
            'authorization' => $authorization['mode'] ?? 'unknown',
            'token_id' => (int) ($authorization['token_id'] ?? 0),
            'uses_remaining' => $authorization['uses_remaining'] ?? null,
        ], 201);
    } catch (Throwable $error) {
        if (is_resource($output)) fclose($output);
        if (is_resource($input)) fclose($input);
        if (is_string($tempPath) && $tempPath !== '') @unlink($tempPath);

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
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    handle_inbound_upload();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    require_method('GET');
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Inbound File Upload</title>
<style>
body{font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:0 20px;background:#f6f7f9;color:#20242a}
.card{background:#fff;border:1px solid #d9dde3;border-radius:14px;padding:28px;box-shadow:0 4px 18px #0000000d}
.drop{border:2px dashed #9aa4b2;border-radius:12px;padding:44px 20px;text-align:center;cursor:pointer;background:#fafbfc}
.drop.over{border-color:#2563eb;background:#eff6ff}.drop input{display:none}
.name{margin:18px 0 0;font-weight:600;word-break:break-all}.muted{color:#687386}
.row{display:flex;gap:10px;margin-top:20px}.row button{border:0;border-radius:8px;padding:10px 18px;font-weight:600;cursor:pointer}.upload{background:#2563eb;color:#fff}.clear{background:#e5e7eb}.row button:disabled{opacity:.45;cursor:not-allowed}
.token{margin-top:18px;width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd1d9;border-radius:8px}.status{margin-top:18px;min-height:24px}.progress{margin-top:10px;width:100%}
</style>
</head>
<body>
<div class="card">
<h1>Inbound File Upload</h1>
<p class="muted">Drop a file below, or click to choose one. Maximum size: 20 MB.</p>
<div id="drop" class="drop"><input id="file" type="file"><strong>Drag a file here</strong><br><span class="muted">or click to choose a file</span><div id="name" class="name"></div></div>
<input id="token" class="token" type="password" autocomplete="off" placeholder="One-time token (anonymous access only)">
<div class="row"><button id="clear" class="clear" type="button" disabled>Clear</button><button id="upload" class="upload" type="button" disabled>OK / Upload</button></div>
<div id="status" class="status"></div><progress id="progress" class="progress" value="0" max="100" hidden></progress>
</div>
<script>
const drop=document.getElementById('drop'),input=document.getElementById('file'),nameEl=document.getElementById('name'),tokenEl=document.getElementById('token'),upload=document.getElementById('upload'),clear=document.getElementById('clear'),status=document.getElementById('status'),progress=document.getElementById('progress');
let file=null;
const tokenFromUrl=new URLSearchParams(location.search).get('access_token')||'';
if(tokenFromUrl) tokenEl.placeholder='One-time token supplied in URL';
function setFile(f){file=f||null;nameEl.textContent=file?`${file.name} (${Math.ceil(file.size/1024)} KB)`:'';upload.disabled=!file;clear.disabled=!file;status.textContent='';progress.hidden=true;}
drop.onclick=()=>input.click();input.onchange=()=>setFile(input.files[0]);
['dragenter','dragover'].forEach(e=>drop.addEventListener(e,x=>{x.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(e=>drop.addEventListener(e,x=>{x.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>setFile(e.dataTransfer.files[0]));
clear.onclick=()=>{input.value='';setFile(null);};
upload.onclick=()=>{if(!file)return;upload.disabled=true;clear.disabled=true;status.textContent='Uploading…';progress.hidden=false;progress.value=0;const xhr=new XMLHttpRequest();let url=location.pathname;if(tokenFromUrl)url+='?access_token='+encodeURIComponent(tokenFromUrl);xhr.open('POST',url);xhr.setRequestHeader('Content-Type','application/octet-stream');xhr.setRequestHeader('X-Filename',file.name);if(!tokenFromUrl&&tokenEl.value.trim())xhr.setRequestHeader('Authorization','Bearer '+tokenEl.value.trim());xhr.upload.onprogress=e=>{if(e.lengthComputable)progress.value=e.loaded/e.total*100};xhr.onload=()=>{try{const data=JSON.parse(xhr.responseText);if(xhr.status>=200&&xhr.status<300){status.textContent=`✓ Uploaded ${data.filename} (${data.bytes} bytes)`;setFile(null);input.value='';}else{status.textContent=data.error||'Upload failed.';}}catch{status.textContent=xhr.status?`Upload failed (HTTP ${xhr.status}).`:'Upload failed.'}upload.disabled=!file;clear.disabled=!file};xhr.onerror=()=>{status.textContent='Upload failed: network error.';upload.disabled=!file;clear.disabled=!file};xhr.send(file);};
</script>
</body>
</html>
