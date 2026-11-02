# Trip timeline storage

Migration `016_trip_offsets` moves domain time to one UTC `scheduled_start_time`
per trip. Trip start/end caches and all event instants are signed integer
millisecond offsets from that anchor. Negative offsets support early starts.
Interval boundary attributes and time-edit payloads use the same representation.
Durations remain integer milliseconds. Server `created_at` and audit timestamps
are recording metadata, independent of the trip timeline.

The production field is `ENUM('yes','no','break-only')`. Standalone breaks have no
Standard Time and contribute neither Standard nor counted time to aggregates.
The old boolean columns are removed by the migration.

Changing scheduled start is an audited, trip-row-locked transaction. Existing
offsets, including nested interval boundaries, shift by old anchor minus new
anchor. Their absolute instants, identities, and recording metadata stay fixed.
The immutable-event guard permits only this representation change. Failure
rolls back the parent and all children together.

The initial bootstrap SQL remains the legacy schema required by migrations
001–015; `database/apply_admin_permissions.php` then applies 016. Do not install
bootstrap SQL alone. The migration archives original rows before conversion,
retains audit history, and provides datetime compatibility views derived from
the anchor and offsets. API capability `tripStorageVersion: 2` selects the new
client transport. Compatibility datetimes returned by reads are derived values,
never independent sources of truth.

ClockTimer performs duration arithmetic on elapsed epoch milliseconds. Local
clock fields are input/display only; repeated-hour inputs resolve near the
reference instant, and nonexistent spring-forward clock inputs are rejected.
Replaying v2 records uses exact offsets rather than ambiguous local clock text.

Unknown invalid saved states do not invalidate authentication. Active-trip
restoration retains raw records for download, enters recovery, and blocks new
trips until successful restoration or confirmed removal of the saved assignment.
Retry and Trip Log repair are available. Transport/authentication errors remain
errors; they are not silently classified as invalid trip data. A legacy elapsed
boundary before its own interval is ignored as a derived artifact and rebuilt
from the saved interval timing; new v2 records retain strict validation.

Verification: `tests/dst-timeline.mjs`, `tests/trip-replay-identity.mjs`, and
`tests/trip-offset-storage.php` cover DST folds/gaps, reloads, Down, canonical
transport, failed restoration, immutable records, audited rebasing and rollback.

Trip Log settings transport exact edited instants, then normalize them to the
canonical anchor/offset representation. Untouched instants survive scheduled-start
edits across UTC midnight. Offline edits rebase their queued offsets too. Editor
clock labels use civil date/hour fields rather than elapsed hours since midnight;
a 23- or 25-hour DST day must not shift the clock shown to the user.
