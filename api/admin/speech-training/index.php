<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/_core/bootstrap.php';

require_method('GET');

$user =
    require_any_permission(
        PERMISSION_DEVELOPER_PREVIEW,
        PERMISSION_DEVELOPER
    );

$canWrite =
    has_permission(
        $user,
        PERMISSION_DEVELOPER
    );

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WMOF Speech Training</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#081d40;color:#fff;font:14px/1.45 system-ui,sans-serif}
main{width:min(980px,100%);margin:auto;padding:22px}
h1,h2{margin:0}
header{display:flex;align-items:flex-end;gap:14px;margin-bottom:18px}
header div{flex:1}
header p{margin:4px 0 0;color:#a9c8df}
.panel{padding:16px;border:1px solid #6588a8;border-radius:12px;background:#0d2d58;margin-bottom:16px}
.grid{display:grid;grid-template-columns:1fr 1fr 130px;gap:10px}
label{display:grid;gap:5px;color:#cbe1f0;font-size:12px;font-weight:750}
input,select{width:100%;padding:9px 10px;border:1px solid #789fbe;border-radius:7px;background:#173a61;color:#fff;font:inherit}
button{padding:9px 12px;border:1px solid #91b6d5;border-radius:7px;background:#354657;color:#fff;font:inherit;font-weight:750;cursor:pointer}
button.primary{background:#0053e2}
button.danger{background:#672630;border-color:#c96571}
button:disabled,input:disabled,select:disabled{opacity:.55;cursor:default}
.actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px}
.preview{margin-top:10px;color:#a9ddf7;font:12px ui-monospace,monospace}
#message{min-height:1.3em;color:#a9ddf7}
#message.error{color:#ffaaaa}
.list{display:grid;gap:8px}
.row{display:grid;grid-template-columns:minmax(0,1fr) 90px 86px auto;gap:10px;align-items:center;padding:10px;border:1px solid #4c7193;border-radius:8px;background:#102e53}
.mapping{min-width:0}
.mapping strong,.mapping span{display:block;overflow-wrap:anywhere}
.mapping span{color:#9fc9e8}
.meta{text-align:center;color:#bad6e8;font-size:12px}
.row-actions{display:flex;gap:6px;justify-content:flex-end}
.empty{padding:18px;text-align:center;color:#94b9d3}
.badge{display:inline-block;padding:3px 7px;border-radius:999px;background:#1e6a4c;font-size:11px;font-weight:800}
.badge.off{background:#5a4d28}
@media(max-width:700px){main{padding:12px}.grid{grid-template-columns:1fr}.row{grid-template-columns:1fr auto}.row .meta{display:none}.row-actions{grid-column:1/-1;justify-content:flex-start}}
</style>
</head>
<body data-can-write="<?=$canWrite ? 'true' : 'false'?>" data-csrf="<?=htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8')?>">
<main>
<header>
<div>
<h1>Speech Training</h1>
<p>Train observed recognition variants toward canonical WMOF phrases. Developer Preview is read-only.</p>
</div>
</header>

<section class="panel">
<h2>Train correction</h2>
<div class="grid">
<label>
<span>Observed transcript</span>
<input id="observed" maxlength="500" placeholder="sink on" <?=$canWrite ? '' : 'disabled'?>>
</label>
<label>
<span>Canonical phrase</span>
<input id="canonical" maxlength="500" placeholder="sync on" <?=$canWrite ? '' : 'disabled'?>>
</label>
<label>
<span>Match</span>
<select id="matchType" <?=$canWrite ? '' : 'disabled'?>>
<option value="exact">Exact</option>
<option value="prefix">Prefix</option>
</select>
</label>
</div>
<div id="compactPreview" class="preview">Compact keys appear here.</div>
<div class="actions">
<button id="train" class="primary" type="button" <?=$canWrite ? '' : 'disabled'?>>Train mapping</button>
<button id="refresh" type="button">Refresh</button>
<span id="message" role="status" aria-live="polite"></span>
</div>
</section>

<section class="panel">
<h2>Learned corrections</h2>
<div id="list" class="list"></div>
</section>
</main>
<script>
'use strict';

const canWrite =
    document.body.dataset.canWrite ===
    'true';

let csrfToken =
    document.body.dataset.csrf;

const observed =
    document.getElementById('observed');

const canonical =
    document.getElementById('canonical');

const matchType =
    document.getElementById('matchType');

const message =
    document.getElementById('message');

const list =
    document.getElementById('list');

const compactPreview =
    document.getElementById('compactPreview');

const normalize = value =>
    String(value || '')
        .toLocaleLowerCase('en-US')
        .replace(/[^\p{L}\p{N}\s:.]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const compact = value =>
    normalize(value)
        .replace(/\s+/g, '');

const escapeHtml = value =>
    String(value ?? '')
        .replace(
            /[&<>"']/g,
            character => ({
                '&':'&amp;',
                '<':'&lt;',
                '>':'&gt;',
                '"':'&quot;',
                "'":'&#039;'
            })[character]
        );

const showMessage =
    (text, error = false) => {
        message.textContent =
            text;

        message.classList.toggle(
            'error',
            error
        );
    };

const renderPreview = () => {
    compactPreview.textContent =
        'observed: ' +
        (compact(observed.value) || '—') +
        '  →  canonical: ' +
        (compact(canonical.value) || '—');
};

observed.addEventListener(
    'input',
    renderPreview
);

canonical.addEventListener(
    'input',
    renderPreview
);

async function api(
    method = 'GET',
    body
) {
    const url =
        new URL(
            '../../speech-corrections/',
            location.href
        );

    url.searchParams.set(
        'language',
        'en-US'
    );

    if (method === 'GET') {
        url.searchParams.set(
            'manage',
            '1'
        );
    }

    const response =
        await fetch(
            url,
            {
                method,
                credentials:
                    'same-origin',
                cache:
                    'no-store',
                headers: {
                    'Accept':
                        'application/json',
                    ...(body
                        ? {
                            'Content-Type':
                                'application/json',
                            'X-CSRF-Token':
                                csrfToken
                        }
                        : {})
                },
                ...(body
                    ? {
                        body:
                            JSON.stringify(
                                body
                            )
                    }
                    : {})
            }
        );

    const data =
        await response.json();

    if (
        typeof data.csrfToken ===
        'string'
    ) {
        csrfToken =
            data.csrfToken;
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            'Request failed.'
        );
    }

    return data;
}

function rowMarkup(item) {
    return `
        <article class="row" data-id="${item.id}">
            <div class="mapping">
                <strong>${escapeHtml(item.observed)} → ${escapeHtml(item.canonical)}</strong>
                <span>${escapeHtml(item.observedCompact)} → ${escapeHtml(item.canonicalCompact)}</span>
            </div>
            <div class="meta">${escapeHtml(item.matchType)}</div>
            <div class="meta">×${item.occurrences}</div>
            <div class="row-actions">
                <span class="badge ${item.enabled ? '' : 'off'}">${item.enabled ? 'Enabled' : 'Disabled'}</span>
                ${canWrite ? `
                    <button class="toggle" type="button">${item.enabled ? 'Disable' : 'Enable'}</button>
                    <button class="delete danger" type="button">Delete</button>
                ` : ''}
            </div>
        </article>
    `;
}

async function load() {
    try {
        const data =
            await api();

        list.innerHTML =
            data.corrections.length
                ? data.corrections
                    .map(rowMarkup)
                    .join('')
                : '<div class="empty">No trained speech corrections yet.</div>';

        showMessage('');
    }
    catch (error) {
        showMessage(
            error.message,
            true
        );
    }
}

document.getElementById('refresh')
    .addEventListener(
        'click',
        load
    );

document.getElementById('train')
    .addEventListener(
        'click',
        async () => {
            if (!canWrite) {
                return;
            }

            try {
                const data =
                    await api(
                        'POST',
                        {
                            language:
                                'en-US',
                            observed:
                                observed.value,
                            canonical:
                                canonical.value,
                            matchType:
                                matchType.value
                        }
                    );

                showMessage(
                    'Trained mapping. Occurrences: ' +
                    data.correction.occurrences
                );

                observed.value =
                    '';

                canonical.value =
                    '';

                renderPreview();

                await load();
            }
            catch (error) {
                showMessage(
                    error.message,
                    true
                );
            }
        }
    );

list.addEventListener(
    'click',
    async event => {
        if (!canWrite) {
            return;
        }

        const row =
            event.target.closest(
                '.row'
            );

        if (!row) {
            return;
        }

        const id =
            Number(
                row.dataset.id
            );

        try {
            const current =
                (await api())
                    .corrections
                    .find(
                        item =>
                            item.id === id
                    );

            if (!current) {
                throw new Error(
                    'Correction no longer exists.'
                );
            }

            if (
                event.target
                    .classList
                    .contains('delete')
            ) {
                await api(
                    'DELETE',
                    {id}
                );

                await load();
                return;
            }

            if (
                event.target
                    .classList
                    .contains('toggle')
            ) {
                await api(
                    'PUT',
                    {
                        id,
                        language:
                            current.language,
                        observed:
                            current.observed,
                        canonical:
                            current.canonical,
                        matchType:
                            current.matchType,
                        enabled:
                            !current.enabled
                    }
                );

                await load();
            }
        }
        catch (error) {
            showMessage(
                error.message,
                true
            );
        }
    }
);

renderPreview();
load();
</script>
</body>
</html>
