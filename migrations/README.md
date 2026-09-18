# Migrations

Add immutable files named 001_description.php, 002_description.php, etc.
Each file returns a nonempty array of complete SQL statements. Each statement
is executed separately by PDO; strings, comments and stored procedure bodies
do not need a custom semicolon parser. Scripts are trusted repository code,
deployed with the app; the endpoint cannot upload or edit scripts.

The live migrations/applied.json file records migration IDs, checksums,
status, actor, change ID and application time. It is generated, ignored by Git,
and preserved across deployments. schema_migrations in the database is the
authoritative record; the file is refreshed after execution and status requests.
Both scripts and the ledger are denied direct HTTP access.

POST /api/admin/sql/ with:
    {"action":"migrations","password":"your password"}
lists available scripts and recorded statuses.

To apply one:
    {"action":"migrate","migration":"001_admin_permissions","password":"your password"}

Both require HTTPS, a superuser session, X-CSRF-Token and
admin_migrations_enabled=true. Arbitrary SQL remains independently controlled
by admin_sql_enabled. Requests apply scripts in order, lock migration execution,
check SHA-256 checksums, and safely skip an identical applied migration.

A failed or interrupted migration blocks later scripts and automatic retries.
DML is rolled back when possible; MySQL DDL can commit implicitly. Reconcile
the schema/data manually before correcting the record. Never edit an applied
script. Add a new script for further changes.

Deployment prepares the writable applied.json file and records the existing
idempotent permission migration. Future migrations are applied explicitly
through the superuser endpoint. The PHP worker owns only the ledger file,
not the script directory.
