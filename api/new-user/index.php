<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_core/bootstrap.php';
require_once dirname(__DIR__) . '/_core/new_user_invites.php';

$method = require_method('GET', 'POST');

if ($method === 'POST') {
    $input = json_input();
    $grant = $_SESSION['new_user_invitation'] ?? null;

    if (!is_array($grant) || (int) ($grant['expiresAt'] ?? 0) <= time()) {
        api_error(
            'This invitation has expired. Ask an administrator for a new one.',
            410,
            'invitation_expired'
        );
    }

    if (
        !is_string($input['csrfToken'] ?? null) ||
        !is_string($grant['csrfToken'] ?? null) ||
        !hash_equals($grant['csrfToken'], $input['csrfToken'])
    ) {
        api_error(
            'The invitation form expired. Reload the scanned link.',
            403,
            'csrf_invalid'
        );
    }

    if (($input['password'] ?? null) !== ($input['confirmPassword'] ?? null)) {
        api_error('Passwords do not match.', 422, 'password_mismatch');
    }

    $account = array_intersect_key(
        $input,
        array_flip([
            'firstName',
            'lastName',
            'preferredName',
            'username',
            'password',
        ])
    );

    $user = create_invited_user(
        db(),
        isset($grant['ownerUserId']) && $grant['ownerUserId'] !== null
            ? (int) $grant['ownerUserId']
            : null,
        (int) ($grant['permissions'] ?? 0),
        $account
    );

    $preservedInvitation =
        empty($grant['singleUse'])
            ? $grant
            : null;

    $_SESSION = [];
    session_regenerate_id(true);

    if ($preservedInvitation !== null) {
        $_SESSION['new_user_invitation'] = $preservedInvitation;
    }

    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

    json_response([
        'user' => $user,
        'created' => true,
        'csrfToken' => $_SESSION['csrf_token'],
        'redirect' => '/',
    ], 201);
}

$rawToken = is_string($_GET['token'] ?? null)
    ? trim($_GET['token'])
    : '';

if ($rawToken === '') {
    http_response_code(410);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta name="viewport" content="width=device-width"><title>Invitation unavailable</title><p>This invitation is invalid, expired, or already used. Ask an administrator for a new one.</p>';
    exit;
}

$authorization = consume_access_token(
    $rawToken,
    [],
    ACCESS_TOKEN_SCOPE_NEW_USER
);

$csrf = bin2hex(random_bytes(32));
$_SESSION['new_user_invitation'] = [
    'tokenId' => (int) $authorization['token_id'],
    'ownerUserId' => $authorization['owner_user_id'] === null
        ? null
        : (int) $authorization['owner_user_id'],
    'permissions' => (int) $authorization['permissions'],
    'expiresAt' => (int) $authorization['expires_at'],
    'singleUse' => (bool) ($authorization['single_use'] ?? false),
    'csrfToken' => $csrf,
];

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Create Profile</title>
<style>
:root{color-scheme:light;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#001e60;color:#001e60}
*{box-sizing:border-box}
html{min-width:320px;background:#001e60}
body{min-height:100dvh;margin:0;padding:clamp(16px,4vw,36px) 14px;display:grid;place-items:center;background:radial-gradient(circle at 50% 0,rgb(0 83 226 / 42%),transparent 42%),#001e60}
.profile-card{width:min(100%,580px);overflow:hidden;border:1px solid rgb(169 221 247 / 82%);border-radius:18px;background:#a9ddf7;box-shadow:0 22px 60px rgb(0 0 0 / 38%)}
.profile-header{padding:18px 28px 17px;text-align:center;background:linear-gradient(180deg,#46515c 0%,#2f3943 48%,#202933 100%);border-bottom:1px solid rgb(255 255 255 / 35%);color:#fff}
.new-user-icon{display:block;width:72px;height:72px;margin:0 auto 5px;overflow:visible}
.brand{margin:0 0 3px;color:#a9ddf7;font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
.profile-header h1{margin:0;font-size:clamp(28px,7vw,38px);line-height:1.1}
.profile-header p{margin:7px 0 0;color:rgb(255 255 255 / 84%);font-size:15px}
.profile-body{padding:20px clamp(18px,5vw,30px) 24px}
fieldset{min-width:0;margin:0 0 18px;padding:0;border:0}
legend{width:100%;margin:0 0 11px;padding:0 0 7px;border-bottom:1px solid rgb(0 30 96 / 30%);font-size:16px;font-weight:800}
.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px 14px}
.field-grid .wide{grid-column:1/-1}
label{min-width:0;display:grid;gap:6px;color:#001e60;font-size:14px;font-weight:750}
.optional{font-size:12px;font-weight:600;opacity:.7}
input{width:100%;min-width:0;height:46px;padding:10px 12px;border:2px solid transparent;border-radius:9px;outline:0;background:#fff;color:#001e60;font:inherit;font-size:16px;box-shadow:0 1px 2px rgb(0 30 96 / 15%);transition:border-color 140ms ease,box-shadow 140ms ease}
input:hover{border-color:rgb(0 83 226 / 36%)}
input:focus{border-color:#0053e2;box-shadow:0 0 0 3px rgb(0 83 226 / 20%)}
input::placeholder{color:rgb(0 30 96 / 46%)}
.form-note{margin:-5px 0 15px;color:rgb(0 30 96 / 76%);font-size:13px;line-height:1.4}
#message{min-height:21px;margin:0 0 8px;padding:0;color:#7b1734;font-size:14px;font-weight:750;text-align:center}
#message:empty{display:none}
.submit-button{width:100%;min-height:50px;display:grid;place-items:center;margin:0;padding:11px 18px;border:1px solid rgb(255 255 255 / 66%);border-radius:10px;background:#0053e2;color:#fff;font:inherit;font-size:17px;font-weight:800;box-shadow:0 5px 12px rgb(0 30 96 / 22%);cursor:pointer;transition:filter 140ms ease,transform 100ms ease}
.submit-button:hover{filter:brightness(1.08)}
.submit-button:active{transform:translateY(1px)}
.submit-button:disabled{cursor:wait;opacity:.72}
@media(max-width:520px){
    body{place-items:start center;padding:10px}
    .profile-card{border-radius:14px}
    .profile-header{padding:15px 18px 14px}
    .new-user-icon{width:62px;height:62px}
    .profile-body{padding:17px 16px 19px}
    .field-grid{grid-template-columns:1fr;gap:11px}
    .field-grid .wide{grid-column:auto}
    fieldset{margin-bottom:15px}
}
</style>
</head>
<body>
<main class="profile-card">
<header class="profile-header">
<svg class="new-user-icon" viewBox="0 0 24 24" role="img" aria-label="New user">
<defs>
<linearGradient id="newUserGradient" x1="-8" y1="0" x2="32" y2="24" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#00d4ff"/>
<stop offset=".32" stop-color="#4f7cff"/>
<stop offset=".64" stop-color="#ffc220"/>
<stop offset="1" stop-color="#ff5aa5"/>
<animateTransform attributeName="gradientTransform" type="rotate" from="0 12 12" to="360 12 12" dur="6s" repeatCount="indefinite"/>
</linearGradient>
<mask id="newUserMask" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
<rect width="24" height="24" fill="black"/>
<circle cx="9" cy="8" r="4" fill="white"/>
<path d="M2 21c0-4 3.1-7 7-7 2 0 3.8.8 5.1 2.1M18 11v8M14 15h8" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
</mask>
</defs>
<rect width="24" height="24" fill="url(#newUserGradient)" mask="url(#newUserMask)"/>
</svg>
<p class="brand">WMOF</p>
<h1>Create Your Profile</h1>
<p>Walmart Order Filler</p>
</header>
<form id="profile" class="profile-body">
<fieldset>
<legend>Personal details</legend>
<div class="field-grid">
<label>First name<input name="firstName" autocomplete="given-name" required maxlength="100" placeholder="First name"></label>
<label>Last name<input name="lastName" autocomplete="family-name" required maxlength="100" placeholder="Last name"></label>
<label class="wide">Preferred name <span class="optional">Optional</span><input name="preferredName" autocomplete="nickname" maxlength="100" placeholder="What should we call you?"></label>
</div>
</fieldset>
<fieldset>
<legend>Sign-in details</legend>
<div class="field-grid">
<label class="wide">Username<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="191" placeholder="Choose a username"></label>
<label>Password<input name="password" type="password" autocomplete="new-password" required maxlength="72" placeholder="Create a password"></label>
<label>Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" required maxlength="72" placeholder="Enter it again"></label>
</div>
</fieldset>
<p class="form-note">Your profile will be signed in automatically after it is created.</p>
<p id="message" role="alert" aria-live="polite"></p>
<button class="submit-button" type="submit">Create Profile</button>
</form>
</main>
<script>
const form=document.getElementById('profile');
const message=document.getElementById('message');
const button=form.querySelector('button');
form.addEventListener('submit',async event=>{
    event.preventDefault();
    message.textContent='Creating your profile…';
    button.disabled=true;
    const body=Object.fromEntries(new FormData(form));
    body.csrfToken=<?=json_encode($csrf, JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT)?>;
    try{
        const response=await fetch(location.href,{
            method:'POST',
            credentials:'same-origin',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(body)
        });
        const data=await response.json();
        if(!response.ok){
            message.textContent=data.message||'Unable to create profile.';
            button.disabled=false;
            return;
        }
        location.replace(data.redirect||'/');
    }catch(error){
        message.textContent='Unable to connect. Check your connection and try again.';
        button.disabled=false;
    }
});
</script>
</body>
</html>
