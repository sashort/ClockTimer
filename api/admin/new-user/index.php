<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/_core/bootstrap.php';
require_once dirname(__DIR__, 2) . '/_core/new_user_invites.php';

$actor = require_permission(PERMISSION_CREATE_USERS);
$method = require_method('GET', 'POST');
$pdo = db();

$rows = $pdo
    ->query('SELECT value, name, description FROM permissions ORDER BY value')
    ->fetchAll();

$grantablePermissions = [];
foreach ($rows as $row) {
    $value = (int) $row['value'];

    if (!has_permission($actor, $value)) {
        continue;
    }

    $grantablePermissions[$value] = [
        'value' => $value,
        'name' => (string) $row['name'],
        'description' => (string) $row['description'],
    ];
}

$selectedPermissions = [];
$multiUse = false;
$previousToken = '';

if ($method === 'POST') {
    $provided = $_POST['csrf_token'] ?? '';
    $expected = $_SESSION['csrf_token'] ?? '';

    if (
        !is_string($provided) ||
        !is_string($expected) ||
        $provided === '' ||
        !hash_equals($expected, $provided)
    ) {
        api_error('The CSRF token is invalid or expired.', 403, 'invalid_csrf');
    }

    $postedPermissions = $_POST['permissions'] ?? [];
    if (!is_array($postedPermissions)) {
        api_error('permissions must be a list.', 422, 'invalid_argument');
    }

    $permissionMask = 0;
    foreach ($postedPermissions as $value) {
        if (!is_string($value) || !ctype_digit($value)) {
            api_error('A selected permission is invalid.', 422, 'invalid_argument');
        }

        $permission = (int) $value;
        if (!isset($grantablePermissions[$permission])) {
            api_error(
                'You cannot grant a permission you do not have.',
                403,
                'permission_required'
            );
        }

        $selectedPermissions[$permission] = true;
        $permissionMask |= $permission;
    }

    $multiUse = isset($_POST['multi_use']);
    $previousToken = is_string($_POST['token'] ?? null)
        ? $_POST['token']
        : '';

    $token = replace_new_user_token(
        $pdo,
        (int) $actor['id'],
        $previousToken,
        $permissionMask,
        $multiUse
    );
} else {
    $token = create_new_user_token(
        $pdo,
        (int) $actor['id'],
        0,
        false
    );
}

$scheme =
    (!empty($_SERVER['HTTPS']) &&
    strtolower((string) $_SERVER['HTTPS']) !== 'off')
        ? 'https'
        : 'http';
$host = (string) ($_SERVER['HTTP_HOST'] ?? '');

if (!preg_match('/^[A-Za-z0-9.\-:\[\]]+$/D', $host)) {
    api_error('Invalid request host.', 400, 'invalid_host');
}

$link =
    $scheme
    . '://'
    . $host
    . '/api/new-user/?token='
    . rawurlencode($token);

$permissionLabel = static function (string $name): string {
    return ucwords(str_replace('_', ' ', $name));
};

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>New User Invitation</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#a9ddf7;color:#001e60}
*{box-sizing:border-box}
html,body{width:100%;min-height:100%;margin:0}
body{padding:18px;display:grid;align-content:start;justify-items:center;gap:10px;text-align:center;background:#a9ddf7;color:#001e60}
header{width:100%;display:grid;place-items:center}
h1{width:min(100%,460px);margin:0;padding:10px 14px;background:linear-gradient(180deg,#46515c 0%,#2f3943 45%,#202933 100%);border-bottom:1px solid rgb(255 255 255 / 54%);border-radius:14px;color:#fff;font-size:clamp(20px,5vw,30px);white-space:nowrap}
.controls{width:min(100%,460px);display:flex;align-items:flex-start;justify-content:center;gap:10px;flex-wrap:wrap}
.permissions{position:relative;min-width:210px;text-align:left}
.permissions summary{list-style:none;padding:9px 12px;border:1px solid #5b81a5;border-radius:8px;background:#fff;color:#001e60;font-weight:800;cursor:pointer}
.permissions summary::-webkit-details-marker{display:none}
.permissions summary::after{content:"▾";float:right}
.permissions[open] summary::after{content:"▴"}
.permission-menu{position:absolute;z-index:5;top:calc(100% + 5px);left:0;width:min(340px,82vw);max-height:240px;overflow:auto;padding:8px;border:1px solid #5b81a5;border-radius:9px;background:#fff;box-shadow:0 12px 28px rgb(0 30 96 / 24%)}
.permission-menu label{display:grid;grid-template-columns:22px 1fr;gap:8px;padding:7px;border-radius:6px;color:#001e60}
.permission-menu label:hover{background:#e8f6fd}
.permission-menu small{grid-column:2;color:#31577d}
.multi-use{display:flex;align-items:center;gap:7px;min-height:40px;padding:8px 12px;border:1px solid #5b81a5;border-radius:8px;background:#fff;color:#001e60;font-weight:800}
input[type=checkbox]{width:18px;height:18px;accent-color:#0053e2}
.instructions{margin:0 8px;line-height:20px}
#qr{display:inline-block;background:#fff;padding:10px;border-radius:10px}
#qr img,#qr canvas,#qr svg{display:block;width:min(58vw,35vh,280px)!important;height:auto!important}
.expires{margin:0;color:#001e60;font-weight:700}
form{display:grid;justify-items:center;gap:10px;width:100%}
.actions{display:flex;gap:8px}
button{font:inherit;font-weight:700;padding:10px 20px;border:1px solid #a9ddf7;border-radius:7px;background:#0053e2;color:#fff;cursor:pointer}
</style>
</head>
<body>
<header><h1>Scan to Create Profile</h1></header>
<form method="post">
<div class="controls">
<details class="permissions">
<summary>Initial permissions<?=count($selectedPermissions) ? ' (' . count($selectedPermissions) . ')' : ''?></summary>
<div class="permission-menu">
<?php if ($grantablePermissions === []): ?>
<div>No additional permissions available.</div>
<?php else: ?>
<?php foreach ($grantablePermissions as $permission): ?>
<label>
<input
    type="checkbox"
    name="permissions[]"
    value="<?=htmlspecialchars((string) $permission['value'], ENT_QUOTES)?>"
    <?=isset($selectedPermissions[$permission['value']]) ? 'checked' : ''?>
>
<span><?=htmlspecialchars($permissionLabel($permission['name']), ENT_QUOTES)?></span>
<small><?=htmlspecialchars($permission['description'], ENT_QUOTES)?></small>
</label>
<?php endforeach; ?>
<?php endif; ?>
</div>
</details>
<label class="multi-use">
<input type="checkbox" name="multi_use" value="1" <?=$multiUse ? 'checked' : ''?>>
<span>Multi use</span>
</label>
</div>
<p class="instructions">Have the new user scan this code with their camera.</p>
<div id="qr" aria-label="QR code for the new-user invitation"></div>
<p class="expires">
<?=$multiUse
    ? 'This multi-use invitation expires in 1 hour.'
    : 'This single-use invitation expires in 1 hour.'?>
</p>
<input type="hidden" name="csrf_token" value="<?=htmlspecialchars(csrf_token(), ENT_QUOTES)?>">
<input type="hidden" name="token" value="<?=htmlspecialchars($token, ENT_QUOTES)?>">
<div class="actions"><button type="submit">Regenerate</button></div>
</form>
<script src="../../vendor/qrcode.min.js"></script>
<script>
new QRCode(document.getElementById('qr'),{
    text:<?=json_encode($link, JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT)?>,
    width:360,
    height:360,
    colorDark:'#001e60',
    colorLight:'#ffffff',
    correctLevel:QRCode.CorrectLevel.M
});
</script>
</body>
</html>
