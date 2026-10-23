<?php
declare(strict_types=1);
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
?><!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Account impersonation</title>
<link rel="stylesheet" href="impersonation.css"><main><h1>Account impersonation</h1><p>Access is recorded. The selected account's permissions apply.</p>
<p id="status" role="status">Checking session…</p>
<form id="login" hidden><h2>Sign in</h2><label>Login type<select id="login-type"><option value="password">Username + Password</option><option value="pin">Login ID + PIN</option></select></label>
<label><span id="identity-label">Username</span><input id="identity" autocomplete="username" required maxlength="191"></label>
<label><span id="credential-label">Password</span><input id="credential" type="password" autocomplete="off" required maxlength="512"></label>
<p>A token with Impersonate permission can replace the password or PIN. In that case, enter the target account's username or login ID.</p><button>Sign in</button></form>
<form id="target" hidden><h2>Select account</h2><label>Target username<input id="target-username" required maxlength="191" autocomplete="off"></label><button>Impersonate</button></form>
<section id="active" hidden><h2>Impersonation active</h2><p id="active-account"></p><button id="return" hidden type="button">Return to original account</button><p id="fresh-login" hidden>There is no original account session to return to. Sign out and sign in with your own credentials when finished.</p></section>
<nav><a href="../order-filler.php">Open Order Filler</a><button id="logout" type="button" hidden>Sign out</button></nav></main><script src="impersonation.js" defer></script></html>
