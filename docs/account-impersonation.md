# Audited account impersonation

The browser portal is `/admin/impersonation.php`. The independent JSON endpoint
is `/api/admin/impersonation/`. Both are local changes until deployed with
migration `015_impersonation`.

## Permission and login

`Impersonate` is permission bit 256 (all known permissions: 511). Superuser
implies it. Token creation and new-profile creation load the permissions table;
the migration makes the permission available there. Profile editing includes
its checkbox. Existing roles are not automatically granted the new bit.

There are exactly two login types: Username/Password and Login ID/PIN. Both
use the normal `/api/users/` endpoint. A credential beginning with `wmof_`
uses token validation, rather than password/PIN verification. The identity
field identifies the **target** account. Normal credentials keep their normal
meaning. A malformed or unauthorized token never falls back to password login.

The token must grant Impersonate (or Superuser), be unexpired, retain a valid
issuer grant, satisfy its existing authentication requirement, and have uses
remaining. A New User token cannot impersonate. Impersonate-only authorization
cannot enter a Superuser account; that requires Superuser authorization too.

The token row is locked while the target is validated and the audit record is
inserted. Only then is its usage decremented, or the final-use token deleted.
All those database changes share one transaction. Permission failure, a missing
target, or failed audit insertion leaves the usage unchanged. Original tokens,
passwords, PINs, hashes, and PHP session IDs are never copied into these records.
The PHP session is switched only after the transaction commits.

The portal credential field accepts a token for either login type. The app's
spoken four-digit collectors remain four digits; tokens are supplied through
text input or HTTP, not spoken as a PIN.

## Direct HTTP use

All production calls use HTTPS and a cookie jar. No browser portal is required.

1. `POST /api/users/` with JSON
   `{"action":"connect","username":"TARGET","password":"TOKEN"}`, or
   `{"action":"connect-pin","loginId":"0042","pin":"TOKEN"}`.
   An ordinary password/PIN authenticates its own account instead.
2. Save the response cookie and `csrfToken`. A token login returns the target
   user and `impersonating: true`.
3. `GET /api/admin/impersonation/` returns the current user, impersonation
   metadata (or null), and current CSRF token.

An operator already logged in with Impersonate permission can instead send
`POST /api/admin/impersonation/` with
`{"action":"start","targetUsername":"TARGET"}` (or `targetUserId`) and
`X-CSRF-Token`. This also works without the portal.

Session changes rotate the PHP session ID and CSRF token. Source token-session
grants and source privileges are discarded. Ordinary API authorization uses
the target's current permissions and ownership. The portal notifies other app
tabs to reload so they cannot retain the source account's UI state.

## Return, logout, and audit

`POST /api/admin/impersonation/` with `{"action":"return"}` and the current
CSRF token returns to an actual original authenticated operator, if that account
still has Impersonate permission. The identity is retained server-side, without
passwords. Nested impersonation is rejected. Source token grants are not restored.

A token used from a signed-out session cannot create an authenticated login for
its issuer. There is no original operator to return to in that case: sign out
and authenticate with your own credentials. Normal logout or a new ordinary
login ends the impersonation and discards the return capability.

`impersonation_sessions` records a unique transition ID, issuer/operator ID when
known, target ID, token record ID when applicable, authentication method, start,
and observed end/reason. Identifiers remain after token/account deletion.
An unset end time means no explicit end has been observed; browser closure or
PHP session expiry cannot establish an exact logout time.

`impersonation_changes` links each normal `audited_write` change ID to its
impersonation ID, in the same transaction as the write. The existing `log`
continues to record the effective target user; this link identifies the
impersonation behind it. Raw SQL is a separate guarded administrative interface.

## Validation

`tests/impersonation.php` runs against an isolated SQLite fixture and covers
permission denial, target denial, audit rollback, exact decrement, depletion
removal, target identity/permissions, cleared grants, rotated sessions/CSRF,
revoked return permission, token login by ID, no anonymous return escalation,
and logout. Existing access-token and account-permission suites remain gates.
