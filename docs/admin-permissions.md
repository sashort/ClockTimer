# Administrative permissions

The users.permissions column stores three flags: create_users = 1,
modify_users = 2, superuser = 4. Combine them with bitwise OR.
Superuser implies all permissions. No accounts are automatically promoted.

The Lightsail deployment runs the idempotent database/apply_admin_permissions.php
CLI entry point and verifies the three permission definitions. For manual
application, run database/admin_permissions.sql with a database administrator connection.
For a fresh install, run it after database/create_database.sql.
Grant the first superuser through your server-side database console, with the
audit context described in create_database.sql, using the verified user ID.

## User API

Existing connect, disconnect, GET-current-user and self-delete behavior remains.
POST /api/users/ with action=create creates an account. firstName, lastName,
username and password are required; preferredName is optional. New accounts
default to permissions=0. Only a superuser may supply a permissions field.

PATCH /api/users/ updates supplied account fields. userId defaults to the
signed-in user. A user may edit their own profile, username and password;
modify_users is required for another account. Only superusers can edit another
superuser or assign permissions, including their own.
GET /api/users/?userId=ID reads an account under those same access checks.
DELETE remains limited to the signed-in account.

Every account mutation requires a session cookie and X-CSRF-Token.
Names and usernames are trimmed; passwords preserve spaces. Passwords are
stored as bcrypt hashes and must contain 1â€“72 bytes. Account writes use the
existing audit transaction and never return password hashes.
Permission checks read the current database value rather than a login snapshot.

## Guarded SQL API

POST /api/admin/sql/ accepts {"sql":"SELECT 1 AS ok","password":"your password"}.
Requires HTTPS, a signed-in superuser, CSRF and password confirmation for each
request. Enable it deliberately by adding 'admin_sql_enabled' => true to
/etc/clocktimer/config.php; the default is false. Keep it disabled when unused.
Use the existing app login to obtain the session cookie and CSRF token.
Do not send the password or SQL in a URL.

One SQL statement is allowed per request, enforced by PDO's MySQL driver.
Results are capped at 1,000 returned rows and SQL at 64 KiB. The result cap
does not limit query execution cost. Server logs record actor, change ID and
SQL hash; database triggers retain their existing row-level audit behavior.
The endpoint uses the configured database credentials and their grants.
DDL and writes are allowed within those grants. DDL can commit implicitly;
there is no blanket rollback guarantee. Open explicit transactions are rolled
back before the request ends. Raw SQL can alter accounts, audit structures and
schema if the database grants permit it; this is trusted superuser access.

No admin interface is included. Tests are denied web access by tests/.htaccess.

Run tests with PHP CLI and PDO SQLite:

    php tests/admin_permissions.php
    php tests/admin_sql_guards.php
