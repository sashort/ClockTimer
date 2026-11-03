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

Canonical event responses omit `creationAnchor` and the old `creationTime`,
`scheduledStart`, and `startTime` clock aliases. Reconstruction uses only the
scheduled-start instant and signed offsets. Editor settings expose exact `instants`
instead of midnight-relative clock strings. Historical imports and old offline
queues are normalized at the input boundary; they do not add compatibility anchors
back to API responses. Bank calculations use the scheduled offset too.

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
edits across UTC midnight. Offline edits rebase their queued offsets too. Absolute-time
editors pass the full saved instant to Numberpad, which derives its local clock
and date directly; 23- and 25-hour days must not shift the displayed time.

Older local completed-trip queues derive their own scheduled-start anchor from
their saved start event before upload. They retain their original event instants,
client tokens, account ownership and retry checkpoints; they never borrow the
current timer's anchor. Old cached clients must reload before creating new trips
against the upgraded schema.

New-trip settings and the scheduled-trip window share an unchecked-by-default
`Start in Down Time` draft option. Confirming it creates the normal trip-start
event followed by an open Down interval at that exact same instant. No new
classification or timestamp column is required. Counted work remains zero until
Resume; canonical replay restores this first-entry Down like any other interval.
The option is hidden for an already-running trip and is not a saved user preference.

## Official Start Time and entry drafts

After entering an official percentage, the user chooses whether to show an
Official Start Time. No keeps the existing adjustment-only flow. Yes exposes
an editable derived timeline entry, without changing the factual trip start.
For factual productive duration `W`, earned time `E` (Standard plus original
unused break/buffer credit), and official ratio `P`, its instant is factual
start plus `W - E/P`. Editing that instant reverses the calculation. The
time-derived percentage retains full precision rather than rounding to tenths;
the percentage numberpad still accepts tenths when entered directly.

The entry is a projection of the current official record, not a second stored
datetime. Subsequent factual edits preserve the official percentage and derive
the entry again. Deleting it clears the official percentage in the same audited
edit transaction; clearing the percentage also removes the entry. Audit records
remain internal and are not separate visible timeline entries.

New interval drafts are highlighted until saved. Valid times move them into
chronological order; out-of-trip, reversed, or overlapping times are red and do
not commit the draft. First-entry Down at the actual trip start is valid.
Existing-trip Details omit Actual Start and Trip End; Timeline owns those edits.

Running trips expose Settings, timeline editing, and Delete Trip. Saving an active
edit reloads the authoritative event stream before rebuilding its readouts and
controls. Editing an interval removes stale derived phase boundaries so Running,
Break, and Down reflect the edited timestamps. Tick-driven log refreshes retain
the user's draft; failed/conflicting saves retain it for review. Official
percentages remain completed-only.

Deleting the active trip clears the model, pending interval reference, and edit
session. UI state distinguishes a completed trip from a cleared/deleted trip;
only completion plays the finish animation. Deletion returns to the idle controls.
