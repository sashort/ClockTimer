<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/_core/bootstrap.php';

if (empty($_SERVER['HTTPS']) || strtolower((string) $_SERVER['HTTPS']) === 'off') {
    api_error('HTTPS is required.', 403, 'https_required');
}

$method = require_method('GET', 'POST', 'PUT', 'DELETE');
$consoleRequested = ($_GET['console'] ?? null) === '1';
$accept = strtolower((string) ($_SERVER['HTTP_ACCEPT'] ?? ''));
$browserRequested =
    $consoleRequested ||
    ($method === 'GET' && str_contains($accept, 'text/html'));
$pdo = db();

$requireAccessTokenSchema = static function () use ($pdo): void {
    $databaseName =
        (string) (
            api_config()[
                'database'
            ][
                'name'
            ] ??
            ''
        );

    $statement =
        $pdo->prepare(
            'SELECT COLUMN_NAME '
            . 'FROM information_schema.COLUMNS '
            . 'WHERE TABLE_SCHEMA = :schema_name '
            . 'AND TABLE_NAME = :table_name'
        );

    $statement->execute([
        ':schema_name' =>
            $databaseName,
        ':table_name' =>
            'access_tokens',
    ]);

    $actual =
        array_fill_keys(
            array_map(
                'strval',
                $statement
                    ->fetchAll(
                        PDO::FETCH_COLUMN
                    )
            ),
            true
        );

    $required = [
        'id',
        'owner_user_id',
        'name',
        'token_hash',
        'token_hint',
        'permissions',
        'uses_remaining',
        'delete_on_deplete',
        'requires_authentication',
        'expires_at',
        'created_at',
        'updated_at',
        'last_used_at',
    ];

    $missing =
        array_values(
            array_filter(
                $required,
                static fn (
                    string $column
                ): bool =>
                    !isset(
                        $actual[
                            $column
                        ]
                    )
            )
        );

    if ($actual === []) {
        api_error(
            'The access_tokens table is not installed in the configured WMOF database.',
            503,
            'access_token_schema'
        );
    }

    if ($missing !== []) {
        api_error(
            'The access_tokens table is missing required columns: '
            . implode(
                ', ',
                $missing
            )
            . '.',
            503,
            'access_token_schema'
        );
    }
};

$tokenFormRedeemed = false;
$authorization = null;

if ($method === 'GET' && $browserRequested) {
    $authorization =
        existing_guarded_access(
            [PERMISSION_GRANT_TOKEN_ACCESS],
            ACCESS_TOKEN_SCOPE_ACCESS_TOKENS
        );

    if ($authorization === null) {
        render_access_token_prompt(
            'Access Tokens',
            'Sign in with Grant Token Access permission or enter an access token that grants it.',
            $consoleRequested ? '?console=1' : ''
        );
    }
} elseif (
    $method === 'POST' &&
    access_token_form_value() !== null
) {
    $requireAccessTokenSchema();

    $authorization =
        authorize_guarded_access(
            [PERMISSION_GRANT_TOKEN_ACCESS],
            ACCESS_TOKEN_SCOPE_ACCESS_TOKENS,
            true
        );

    $tokenFormRedeemed = true;
} else {
    $authorization =
        authorize_guarded_access(
            [PERMISSION_GRANT_TOKEN_ACCESS],
            ACCESS_TOKEN_SCOPE_ACCESS_TOKENS
        );
}

$effectivePermissions =
    (int) (
        $authorization[
            'permissions'
        ] ??
        0
    );

if (($authorization['mode'] ?? '') === 'session') {
    $actor = $authorization['user'];
} else {
    // A delegated token gets only the permission carried by the token.
    // Do not inherit the token owner's complete account permission mask.
    $actor = [
        'id' =>
            (int) (
                $authorization[
                    'owner_user_id'
                ] ??
                0
            ),
        'username' =>
            'delegated-token',
        'permissions' =>
            $effectivePermissions,
    ];
}

$isSuperuser =
    permission_mask_allows(
        $effectivePermissions,
        PERMISSION_SUPERUSER
    );

$permissionRows = static function () use ($pdo, $actor): array {
    $rows = $pdo
        ->query('SELECT value, name, description FROM permissions ORDER BY value')
        ->fetchAll();

    $result = [];

    foreach ($rows as $row) {
        $value = (int) $row['value'];

        if (!has_permission($actor, $value)) {
            continue;
        }

        $result[] = [
            'value' => $value,
            'name' => (string) $row['name'],
            'description' => (string) $row['description'],
        ];
    }

    return $result;
};

$tokenRows = static function () use ($pdo, $actor, $isSuperuser): array {
    $sql =
        'SELECT t.id, t.owner_user_id, t.name, t.token_hint, t.permissions, '
        . 'p.name AS permission_name, p.description AS permission_description, '
        . 't.uses_remaining, t.delete_on_deplete, t.requires_authentication, '
        . 't.expires_at, t.created_at, t.updated_at, t.last_used_at, '
        . 'u.username AS owner_username '
        . 'FROM access_tokens t '
        . 'INNER JOIN permissions p ON p.value = t.permissions '
        . 'INNER JOIN users u ON u.id = t.owner_user_id ';

    $params = [];

    if (!$isSuperuser) {
        $sql .= 'WHERE t.owner_user_id = :owner_user_id ';
        $params[':owner_user_id'] = (int) $actor['id'];
    }

    $sql .= 'ORDER BY t.created_at DESC, t.id DESC';

    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll();
    $now = time();

    return array_map(
        static fn(array $row): array => [
            'id' => (int) $row['id'],
            'ownerUserId' => (int) $row['owner_user_id'],
            'ownerUsername' => (string) $row['owner_username'],
            'name' => (string) $row['name'],
            'tokenHint' => (string) $row['token_hint'],
            'permissions' => (int) $row['permissions'],
            'permissionName' => (string) $row['permission_name'],
            'permissionDescription' => (string) $row['permission_description'],
            'counter' => (int) $row['uses_remaining'],
            'deleteOnDeplete' => (bool) $row['delete_on_deplete'],
            'requiresAuthentication' => (bool) $row['requires_authentication'],
            'expiresAt' => (int) $row['expires_at'],
            'createdAt' => (int) $row['created_at'],
            'updatedAt' => (int) $row['updated_at'],
            'lastUsedAt' => $row['last_used_at'] === null ? null : (int) $row['last_used_at'],
            'status' =>
                (int) $row['expires_at'] <= $now
                    ? 'expired'
                    : ((int) $row['uses_remaining'] <= 0 ? 'depleted' : 'active'),
        ],
        $rows
    );
};

$renderConsole = static function () use (
    $permissionRows,
    $isSuperuser,
    $requireAccessTokenSchema
): never {
    $requireAccessTokenSchema();
    $nonce = base64_encode(random_bytes(18));
    $csrfJson = json_encode(
        csrf_token(),
        JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR
    );
    $permissionsJson = json_encode(
        $permissionRows(),
        JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR
    );
    $superuserJson = $isSuperuser ? 'true' : 'false';

    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store, private');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    header(
        "Content-Security-Policy: default-src 'none'; "
        . "script-src 'nonce-$nonce'; style-src 'nonce-$nonce'; connect-src 'self'; "
        . "form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
    );
    ?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WMOF Access Tokens</title>
<style nonce="<?=htmlspecialchars($nonce, ENT_QUOTES, 'UTF-8')?>">
*{box-sizing:border-box}
body{margin:0;background:#081d40;color:#fff;font:14px/1.45 system-ui,sans-serif}
main{max-width:1180px;margin:auto;padding:28px}
header{display:flex;align-items:flex-start;gap:18px;margin-bottom:20px}
header>div{flex:1}h1{margin:0 0 5px;font-size:28px}h2{margin:0;font-size:18px}
p{margin:4px 0;color:#bcd7e9}
.panel{background:#0d2d58;border:1px solid #6f96b8;border-radius:12px;padding:18px;margin-bottom:18px}
.grid{display:grid;grid-template-columns:1.3fr 1.1fr .6fr 1.15fr;gap:12px}
.field{display:grid;gap:5px;color:#c6dfef;font-weight:700;font-size:12px}
.field input,.field select{width:100%;min-width:0;padding:9px 10px;color:#fff;background:#173a61;border:1px solid #789fbe;border-radius:7px;font:inherit}
.checks{display:flex;align-items:center;gap:22px;margin-top:14px;flex-wrap:wrap}
.checks label{display:flex;align-items:center;gap:7px;color:#d9ebf6}
button{padding:9px 13px;border:1px solid #91b6d5;border-radius:7px;background:#354657;color:#fff;font:inherit;font-weight:700;cursor:pointer}
button.primary{background:#0053e2}button.danger{background:#6c2730;border-color:#d26b76}
button:disabled{opacity:.5;cursor:default}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}
#message{min-height:1.4em;margin-top:8px;color:#a9ddf7}#message.error{color:#ff9c9c}
[hidden]{display:none!important}
.token-reveal{display:grid;gap:8px;margin-top:15px;padding:12px;border:1px solid #ffc220;border-radius:8px;background:#2c2b22}
.token-reveal code{display:block;padding:9px;background:#061b3d;border-radius:6px;overflow-wrap:anywhere;user-select:all}
.tokens{display:grid;gap:10px}.token-card{padding:14px;border:1px solid #587fa2;border-radius:9px;background:#102e53}
.token-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}.token-head strong{font-size:15px}.hint{font:12px/1.2 ui-monospace,monospace;color:#9fc9e8}
.badge{margin-left:auto;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:800;text-transform:uppercase}
.badge.active{background:#1d6d4d}.badge.depleted{background:#735e20}.badge.expired{background:#6b3138}
.owner{font-size:11px;color:#9fc9e8}.token-card .grid{grid-template-columns:1.2fr 1fr .55fr 1.05fr}
.meta{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;color:#9fc9e8;font-size:11px}
.empty{padding:22px;text-align:center;color:#9fc9e8;border:1px dashed #587fa2;border-radius:8px}
@media(max-width:850px){.grid,.token-card .grid{grid-template-columns:1fr 1fr}}
@media(max-width:560px){main{padding:14px}.grid,.token-card .grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<main>
<header>
<div>
<h1>Access Tokens</h1>
<p>Create temporary delegated permission grants. Raw tokens are shown only once.</p>
</div>
</header>

<section class="panel" aria-labelledby="create-title">
<h2 id="create-title">Create token</h2>
<div class="grid">
<label class="field"><span>Name</span><input id="name" maxlength="191" required placeholder="Speech editor handoff"></label>
<label class="field"><span>Permission</span><select id="permission"></select></label>
<label class="field"><span>Counter</span><input id="counter" type="number" min="0" step="1" value="1"></label>
<label class="field"><span>Expires</span><input id="expires" type="datetime-local"></label>
</div>
<div class="checks">
<label><input id="deleteOnDeplete" type="checkbox" checked> Delete on deplete</label>
<label><input id="requiresAuthentication" type="checkbox" checked> Requires authentication</label>
</div>
<div class="actions"><button id="create" class="primary" type="button">Create token</button></div>
<div id="message" role="status" aria-live="polite"></div>
<div id="reveal" class="token-reveal" hidden>
<strong>Copy this token now. It will not be shown again.</strong>
<code id="rawToken"></code>
<div><button id="copy" type="button">Copy token</button></div>
</div>
</section>

<section class="panel" aria-labelledby="tokens-title">
<div class="token-head"><h2 id="tokens-title">Tokens</h2><button id="refresh" type="button">Refresh</button></div>
<div id="tokens" class="tokens"></div>
</section>
</main>
<script nonce="<?=htmlspecialchars($nonce, ENT_QUOTES, 'UTF-8')?>">
'use strict';
let csrfToken=<?=$csrfJson?>;
const initialPermissions=<?=$permissionsJson?>;
const canManageAll=<?=$superuserJson?>;
const $=id=>document.getElementById(id);
const message=(text,error=false)=>{$('message').textContent=text;$('message').classList.toggle('error',error)};
const toLocalInput=seconds=>{
    const d=new Date(seconds*1000);
    const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
    return local.toISOString().slice(0,16);
};
const fromLocalInput=value=>Math.floor(new Date(value).getTime()/1000);
const formatTime=seconds=>seconds?new Date(seconds*1000).toLocaleString():'Never';
const setDefaultExpiry=()=>{
    const next=Math.floor(Date.now()/1000)+86400;
    $('expires').value=toLocalInput(next);
};
function permissionOptions(selected){
    return initialPermissions.map(item=>
        `<option value="${item.value}" ${Number(selected)===item.value?'selected':''}>${escapeHtml(item.name)}</option>`
    ).join('');
}
$('permission').innerHTML=permissionOptions();
setDefaultExpiry();

async function api(method='GET',body,retry=true){
    const headers={
        'Accept':'application/json',
        ...(body?{'Content-Type':'application/json'}:{})
    };

    if(method!=='GET'){
        headers['X-CSRF-Token']=csrfToken;
    }

    const response=await fetch(location.pathname,{
        method,
        credentials:'same-origin',
        cache:'no-store',
        headers,
        ...(body?{body:JSON.stringify(body)}:{})
    });

    const data=await response.json();

    if(
        method==='GET' &&
        typeof data.csrfToken==='string' &&
        data.csrfToken.length>=32
    ){
        csrfToken=data.csrfToken;
    }

    if(
        !response.ok &&
        retry &&
        method!=='GET' &&
        data.error==='invalid_csrf'
    ){
        await api('GET',undefined,false);
        return api(method,body,false);
    }

    if(!response.ok){
        throw new Error(data.message||data.error||'Request failed.');
    }

    return data;
}
function escapeHtml(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
function card(token){
    const owner=canManageAll?`<span class="owner">Owner: ${escapeHtml(token.ownerUsername)}</span>`:'';
    return `<article class="token-card" data-id="${token.id}">
        <div class="token-head">
            <strong>${escapeHtml(token.name)}</strong>
            <span class="hint">${escapeHtml(token.tokenHint)}</span>
            ${owner}
            <span class="badge ${token.status}">${token.status}</span>
        </div>
        <div class="grid">
            <label class="field"><span>Name</span><input data-field="name" maxlength="191" value="${escapeHtml(token.name)}"></label>
            <label class="field"><span>Permission</span><select data-field="permissions">${permissionOptions(token.permissions)}</select></label>
            <label class="field"><span>Counter</span><input data-field="counter" type="number" min="0" step="1" value="${token.counter}"></label>
            <label class="field"><span>Expires</span><input data-field="expiresAt" type="datetime-local" value="${toLocalInput(token.expiresAt)}"></label>
        </div>
        <div class="checks">
            <label><input data-field="deleteOnDeplete" type="checkbox" ${token.deleteOnDeplete?'checked':''}> Delete on deplete</label>
            <label><input data-field="requiresAuthentication" type="checkbox" ${token.requiresAuthentication?'checked':''}> Requires authentication</label>
        </div>
        <div class="meta">
            <span>Permission: ${escapeHtml(token.permissionName)}</span>
            <span>Created: ${formatTime(token.createdAt)}</span>
            <span>Last used: ${formatTime(token.lastUsedAt)}</span>
        </div>
        <div class="actions">
            <button class="save primary" type="button">Save</button>
            <button class="delete danger" type="button">Delete</button>
        </div>
    </article>`;
}
async function load(){
    try{
        const data=await api();
        $('tokens').innerHTML=data.tokens.length?data.tokens.map(card).join(''):'<div class="empty">No access tokens.</div>';
    }catch(error){message(error.message,true)}
}
$('create').addEventListener('click',async()=>{
    $('reveal').hidden=true;

    if(!$('name').value.trim()){
        message('Name is required.',true);
        $('name').focus();
        return;
    }

    try{
        const data=await api('POST',{
            name:$('name').value,
            permissions:Number($('permission').value),
            counter:Number($('counter').value),
            expiresAt:fromLocalInput($('expires').value),
            deleteOnDeplete:$('deleteOnDeplete').checked,
            requiresAuthentication:$('requiresAuthentication').checked
        });
        $('rawToken').textContent=data.token;
        $('reveal').hidden=false;
        message('Token created.');
        $('name').value='';
        $('counter').value='1';
        $('deleteOnDeplete').checked=true;
        $('requiresAuthentication').checked=true;
        setDefaultExpiry();
        await load();
    }catch(error){message(error.message,true)}
});
$('copy').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText($('rawToken').textContent);message('Token copied.')}
    catch{message('Copy failed. Select the token and copy it manually.',true)}
});
$('refresh').addEventListener('click',load);
$('tokens').addEventListener('click',async event=>{
    const card=event.target.closest('.token-card');
    if(!card)return;
    const id=Number(card.dataset.id);
    if(event.target.classList.contains('delete')){
        if(!confirm('Delete this access token?'))return;
        try{await api('DELETE',{id});message('Token deleted.');await load();}
        catch(error){message(error.message,true)}
        return;
    }
    if(!event.target.classList.contains('save'))return;
    const field=name=>card.querySelector(`[data-field="${name}"]`);
    try{
        const data=await api('PUT',{
            id,
            name:field('name').value,
            permissions:Number(field('permissions').value),
            counter:Number(field('counter').value),
            expiresAt:fromLocalInput(field('expiresAt').value),
            deleteOnDeplete:field('deleteOnDeplete').checked,
            requiresAuthentication:field('requiresAuthentication').checked
        });
        message(data.deleted?'Token deleted because its counter is depleted.':'Token updated.');
        await load();
    }catch(error){message(error.message,true)}
});
load();
</script>
</body>
</html>
<?php
    exit;
};

if (
    ($method === 'GET' && $browserRequested) ||
    $tokenFormRedeemed
) {
    $renderConsole();
}

$requireAccessTokenSchema();

$permissions = $permissionRows();
$grantable = array_column($permissions, null, 'value');

if ($method === 'GET') {
    json_response([
        'tokens' => $tokenRows(),
        'permissions' => $permissions,
        'canManageAll' => $isSuperuser,
        'csrfToken' => csrf_token(),
    ]);
}

if (guarded_access_requires_csrf($authorization)) {
    require_csrf();
}

$input = json_input();

$nonNegativeInt = static function (mixed $value, string $name): int {
    if (is_string($value) && ctype_digit($value)) {
        $value = (int) $value;
    }

    if (!is_int($value) || $value < 0 || $value > 2147483647) {
        api_error("$name must be an integer between 0 and 2147483647.", 422, 'invalid_argument');
    }

    return $value;
};

$boolean = static function (mixed $value, string $name): bool {
    if (is_bool($value)) {
        return $value;
    }

    if ($value === 0 || $value === 1 || $value === '0' || $value === '1') {
        return (bool) $value;
    }

    api_error("$name must be a boolean.", 422, 'invalid_argument');
};

$expiration = static function (mixed $value): int {
    if (is_int($value) || (is_string($value) && ctype_digit($value))) {
        $seconds = (int) $value;
    } elseif (is_string($value)) {
        try {
            $seconds = (new DateTimeImmutable($value))->getTimestamp();
        } catch (Throwable) {
            api_error('expiresAt must be a valid date/time.', 422, 'invalid_argument');
        }
    } else {
        api_error('expiresAt must be a Unix timestamp or date/time string.', 422, 'invalid_argument');
    }

    if ($seconds < 1) {
        api_error('expiresAt must be greater than zero.', 422, 'invalid_argument');
    }

    return $seconds;
};

$permission = static function (mixed $value) use ($grantable): int {
    if (is_string($value) && ctype_digit($value)) {
        $value = (int) $value;
    }

    if (!is_int($value) || !isset($grantable[$value])) {
        api_error('The selected permission is not grantable by this user.', 403, 'permission_required');
    }

    return $value;
};

$tokenForEdit = static function (int $id, bool $forUpdate = false) use ($pdo, $actor, $isSuperuser): array {
    $sql = 'SELECT * FROM access_tokens WHERE id = :id';

    if (!$isSuperuser) {
        $sql .= ' AND owner_user_id = :owner_user_id';
    }

    if ($forUpdate) {
        $sql .= ' FOR UPDATE';
    }

    $statement = $pdo->prepare($sql);
    $params = [':id' => $id];

    if (!$isSuperuser) {
        $params[':owner_user_id'] = (int) $actor['id'];
    }

    $statement->execute($params);
    $row = $statement->fetch();

    if (!$row) {
        api_error('Access token was not found.', 404, 'token_not_found');
    }

    return $row;
};

if ($method === 'POST') {
    $name = require_string($input, 'name');

    if (strlen($name) > 191) {
        api_error('name is too long.', 422, 'invalid_argument');
    }

    $grantedPermission = $permission($input['permissions'] ?? null);
    $counter = array_key_exists('counter', $input) ? $nonNegativeInt($input['counter'], 'counter') : 1;
    $deleteOnDeplete = array_key_exists('deleteOnDeplete', $input)
        ? $boolean($input['deleteOnDeplete'], 'deleteOnDeplete')
        : true;
    $requiresAuthentication = array_key_exists('requiresAuthentication', $input)
        ? $boolean($input['requiresAuthentication'], 'requiresAuthentication')
        : true;
    $expiresAt = $expiration($input['expiresAt'] ?? null);

    if ($expiresAt <= time()) {
        api_error('expiresAt must be in the future when creating a token.', 422, 'invalid_argument');
    }

    if ($counter === 0 && $deleteOnDeplete) {
        api_error('A token created with delete on deplete must start with a counter above zero.', 422, 'invalid_argument');
    }

    $rawToken = access_token_generate();
    $now = time();
    $hint = substr($rawToken, 0, 10) . '…' . substr($rawToken, -4);

    $statement = $pdo->prepare(
        'INSERT INTO access_tokens '
        . '(owner_user_id, name, token_hash, token_hint, permissions, uses_remaining, '
        . 'delete_on_deplete, requires_authentication, expires_at, created_at, updated_at) '
        . 'VALUES (:owner_user_id, :name, :token_hash, :token_hint, :permissions, :uses_remaining, '
        . ':delete_on_deplete, :requires_authentication, :expires_at, :created_at, :updated_at)'
    );
    $statement->execute([
        ':owner_user_id' => (int) $actor['id'],
        ':name' => $name,
        ':token_hash' => access_token_hash($rawToken),
        ':token_hint' => $hint,
        ':permissions' => $grantedPermission,
        ':uses_remaining' => $counter,
        ':delete_on_deplete' => $deleteOnDeplete ? 1 : 0,
        ':requires_authentication' => $requiresAuthentication ? 1 : 0,
        ':expires_at' => $expiresAt,
        ':created_at' => $now,
        ':updated_at' => $now,
    ]);

    json_response([
        'created' => true,
        'id' => (int) $pdo->lastInsertId(),
        'token' => $rawToken,
        'tokenHint' => $hint,
    ], 201);
}

$id = $nonNegativeInt($input['id'] ?? null, 'id');

if ($id < 1) {
    api_error('id must be a positive integer.', 422, 'invalid_argument');
}

if ($method === 'DELETE') {
    $tokenForEdit($id);

    $statement = $pdo->prepare(
        'DELETE FROM access_tokens WHERE id = :id'
        . ($isSuperuser ? '' : ' AND owner_user_id = :owner_user_id')
    );

    $params = [':id' => $id];

    if (!$isSuperuser) {
        $params[':owner_user_id'] = (int) $actor['id'];
    }

    $statement->execute($params);

    json_response([
        'deleted' => true,
        'id' => $id,
    ]);
}

$row = $tokenForEdit($id);

$name = array_key_exists('name', $input)
    ? require_string($input, 'name')
    : (string) $row['name'];

if (strlen($name) > 191) {
    api_error('name is too long.', 422, 'invalid_argument');
}

$grantedPermission = array_key_exists('permissions', $input)
    ? $permission($input['permissions'])
    : (int) $row['permissions'];

$counter = array_key_exists('counter', $input)
    ? $nonNegativeInt($input['counter'], 'counter')
    : (int) $row['uses_remaining'];

$deleteOnDeplete = array_key_exists('deleteOnDeplete', $input)
    ? $boolean($input['deleteOnDeplete'], 'deleteOnDeplete')
    : (bool) $row['delete_on_deplete'];

$requiresAuthentication = array_key_exists('requiresAuthentication', $input)
    ? $boolean($input['requiresAuthentication'], 'requiresAuthentication')
    : (bool) $row['requires_authentication'];

$expiresAt = array_key_exists('expiresAt', $input)
    ? $expiration($input['expiresAt'])
    : (int) $row['expires_at'];

if ($counter === 0 && $deleteOnDeplete) {
    $delete = $pdo->prepare(
        'DELETE FROM access_tokens WHERE id = :id'
        . ($isSuperuser ? '' : ' AND owner_user_id = :owner_user_id')
    );

    $deleteParams = [
        ':id' => $id,
    ];

    if (!$isSuperuser) {
        $deleteParams[':owner_user_id'] =
            (int) $actor['id'];
    }

    $delete->execute(
        $deleteParams
    );

    json_response([
        'deleted' => true,
        'id' => $id,
        'reason' => 'depleted',
    ]);
}

$update = $pdo->prepare(
    'UPDATE access_tokens SET '
    . 'name = :name, permissions = :permissions, uses_remaining = :uses_remaining, '
    . 'delete_on_deplete = :delete_on_deplete, requires_authentication = :requires_authentication, '
    . 'expires_at = :expires_at, updated_at = :updated_at '
    . 'WHERE id = :id'
    . ($isSuperuser ? '' : ' AND owner_user_id = :owner_user_id')
);

$updateParams = [
    ':name' => $name,
    ':permissions' => $grantedPermission,
    ':uses_remaining' => $counter,
    ':delete_on_deplete' => $deleteOnDeplete ? 1 : 0,
    ':requires_authentication' => $requiresAuthentication ? 1 : 0,
    ':expires_at' => $expiresAt,
    ':updated_at' => time(),
    ':id' => $id,
];

if (!$isSuperuser) {
    $updateParams[':owner_user_id'] =
        (int) $actor['id'];
}

$update->execute(
    $updateParams
);

json_response([
    'updated' => true,
    'deleted' => false,
    'id' => $id,
]);
