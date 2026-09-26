<?php
declare(strict_types=1);

function sql_statement_has_content(string $statement): bool
{
    $withoutComments = preg_replace(
        [
            '/--[ \t][^\r\n]*/',
            '/#[^\r\n]*/',
            '/\/\*.*?\*\//s',
        ],
        '',
        $statement
    );

    return trim((string) $withoutComments) !== '';
}

function split_sql_statements(string $sql): array
{
    $statements = [];
    $buffer = '';
    $delimiter = ';';
    $length = strlen($sql);
    $quote = null;
    $lineComment = false;
    $blockComment = false;

    for ($index = 0; $index < $length;) {
        if (
            $quote === null &&
            !$lineComment &&
            !$blockComment &&
            ($index === 0 || $sql[$index - 1] === "\n")
        ) {
            $lineEnd = strpos($sql, "\n", $index);
            $lineEnd = $lineEnd === false ? $length : $lineEnd;
            $line = substr($sql, $index, $lineEnd - $index);

            if (preg_match('/^[ \t]*DELIMITER[ \t]+(\S+)[ \t]*\r?$/iD', $line, $matches)) {
                $nextDelimiter = $matches[1];

                if ($nextDelimiter === '' || strlen($nextDelimiter) > 16) {
                    throw new InvalidArgumentException('Invalid SQL delimiter.');
                }

                $delimiter = $nextDelimiter;
                $index = $lineEnd < $length ? $lineEnd + 1 : $length;
                continue;
            }
        }

        $char = $sql[$index];
        $next = $index + 1 < $length ? $sql[$index + 1] : '';

        if ($lineComment) {
            $buffer .= $char;
            $index++;

            if ($char === "\n") {
                $lineComment = false;
            }

            continue;
        }

        if ($blockComment) {
            $buffer .= $char;

            if ($char === '*' && $next === '/') {
                $buffer .= '/';
                $index += 2;
                $blockComment = false;
                continue;
            }

            $index++;
            continue;
        }

        if ($quote !== null) {
            $buffer .= $char;

            if ($char === '\\' && $index + 1 < $length) {
                $buffer .= $sql[$index + 1];
                $index += 2;
                continue;
            }

            if ($char === $quote) {
                if ($next === $quote) {
                    $buffer .= $next;
                    $index += 2;
                    continue;
                }

                $quote = null;
            }

            $index++;
            continue;
        }

        if ($char === "'" || $char === '"' || $char === '`') {
            $quote = $char;
            $buffer .= $char;
            $index++;
            continue;
        }

        if ($char === '/' && $next === '*') {
            $blockComment = true;
            $buffer .= '/*';
            $index += 2;
            continue;
        }

        if ($char === '#') {
            $lineComment = true;
            $buffer .= $char;
            $index++;
            continue;
        }

        if ($char === '-' && $next === '-') {
            $after = $index + 2 < $length ? $sql[$index + 2] : '';

            if ($after === '' || ctype_space($after)) {
                $lineComment = true;
                $buffer .= '--';
                $index += 2;
                continue;
            }
        }

        if (
            $delimiter !== '' &&
            substr($sql, $index, strlen($delimiter)) === $delimiter
        ) {
            $statement = trim($buffer);

            if ($statement !== '' && sql_statement_has_content($statement)) {
                $statements[] = $statement;
            }

            $buffer = '';
            $index += strlen($delimiter);
            continue;
        }

        $buffer .= $char;
        $index++;
    }

    if ($quote !== null || $blockComment) {
        throw new InvalidArgumentException('SQL contains an unterminated string, identifier, or block comment.');
    }

    $statement = trim($buffer);

    if ($statement !== '' && sql_statement_has_content($statement)) {
        $statements[] = $statement;
    }

    return $statements;
}

function render_sql_console(string $csrfToken, bool $requiresPassword = true): never
{
    $nonce = base64_encode(random_bytes(18));
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; script-src 'nonce-$nonce'; style-src 'nonce-$nonce'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    $csrfJson = json_encode($csrfToken, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR);
    $requiresPasswordJson = $requiresPassword ? 'true' : 'false';
    ?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Superuser SQL console</title>
<style nonce="<?= htmlspecialchars($nonce, ENT_QUOTES, 'UTF-8') ?>">
* { box-sizing: border-box; }
body { margin: 0; padding: 32px 20px; background: #f3f5f7; color: #18212b; font: 16px/1.5 system-ui, sans-serif; }
main { max-width: 960px; margin: auto; background: white; border: 1px solid #d8dee5; border-radius: 12px; padding: 28px; }
h1 { margin: 0 0 8px; font-size: 26px; }
p { color: #556270; }
label { display: block; margin: 18px 0 6px; font-weight: 600; }
textarea, input { width: 100%; padding: 12px; border: 1px solid #aab5c1; border-radius: 6px; font: inherit; }
textarea { min-height: 220px; resize: vertical; font-family: ui-monospace, monospace; }
input { max-width: 440px; }
.buttons { display: flex; gap: 10px; margin: 20px 0; }
button { padding: 10px 24px; border: 1px solid #aab5c1; border-radius: 6px; background: white; font: inherit; cursor: pointer; }
button[type=submit] { background: #235dcc; border-color: #235dcc; color: white; }
button:disabled { opacity: .6; cursor: wait; }
#message { min-height: 24px; white-space: pre-wrap; }
#message[data-state=success] { color: #146c36; }
#message[data-state=error] { color: #b42318; }
pre { max-height: 500px; overflow: auto; padding: 16px; background: #f3f5f7; border-radius: 6px; white-space: pre-wrap; overflow-wrap: anywhere; }
:focus-visible { outline: 3px solid #82aaff; outline-offset: 2px; }
</style>
</head>
<body>
<main>
<h1>Superuser SQL console</h1>
<p>Enter one or more SQL statements. Statements run in order and stop on the first failure.</p>
<form id="sql-form">
<label for="sql">SQL</label>
<textarea id="sql" name="sql" spellcheck="false" required placeholder="SELECT 1 AS first;&#10;SELECT 2 AS second;"></textarea>
<div id="password-field">
<label for="password">Confirm password</label>
<input id="password" name="password" type="password" autocomplete="current-password">
</div>
<div class="buttons">
<button id="ok" type="submit">OK</button>
<button id="clear" type="button">Clear</button>
</div>
</form>
<div id="message" role="status" aria-live="polite"></div>
<pre id="result" hidden aria-label="SQL result"></pre>
</main>
<script nonce="<?= htmlspecialchars($nonce, ENT_QUOTES, 'UTF-8') ?>">
'use strict';
const csrfToken = <?= $csrfJson ?>;
const requiresPassword = <?= $requiresPasswordJson ?>;
const form = document.getElementById('sql-form');
const sql = document.getElementById('sql');
const password = document.getElementById('password');
const ok = document.getElementById('ok');
const clear = document.getElementById('clear');
const message = document.getElementById('message');
const result = document.getElementById('result');
const passwordField = document.getElementById('password-field');
password.required = requiresPassword;
passwordField.hidden = !requiresPassword;
function show(text, state) {
    message.textContent = text;
    message.dataset.state = state;
}
clear.addEventListener('click', () => {
    form.reset();
    show('', '');
    result.textContent = '';
    result.hidden = true;
    sql.focus();
});
form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    ok.disabled = clear.disabled = true;
    sql.readOnly = password.readOnly = true;
    result.hidden = true;
    show('Running…', '');
    try {
        const response = await fetch(location.pathname, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({
                action: 'execute',
                sql: sql.value,
                ...(requiresPassword ? {password: password.value} : {})
            })
        });
        const data = await response.json();
        if (!response.ok) {
            show('Failed: ' + (data.message || data.error || 'HTTP ' + response.status), 'error');
            return;
        }
        const statementCount = Number(data.statementCount) || 1;
        const truncated = Boolean(data.truncated) || (data.results || []).some(item => item.truncated);
        show(
            'Success. ' +
            statementCount +
            ' statement' +
            (statementCount === 1 ? '' : 's') +
            ' completed.' +
            (truncated ? ' One or more result sets were truncated to 1,000 rows.' : ''),
            'success'
        );
        result.textContent = JSON.stringify(data, null, 2);
        result.hidden = false;
    } catch (error) {
        show('Failed: ' + error.message, 'error');
    } finally {
        password.value = '';
        ok.disabled = clear.disabled = false;
        sql.readOnly = password.readOnly = false;
    }
});
</script>
</body>
</html>
<?php
    exit;
}
